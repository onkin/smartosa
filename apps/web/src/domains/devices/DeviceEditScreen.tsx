'use client';

import {useHomeData, useTargetVisit} from '@/domains/shell';
import {Button, Card, EmbedFrame, Field, PageHeader, Select, TextInput} from '@/domains/ui';
import {
  cameraStreamName,
  createId,
  deviceOpenUrl,
  go2rtcBaseUrl,
  go2rtcPublishUrl,
  isRtspUrl,
  preferRtspMainstream,
  suggestSnapshotFromRtsp,
  type CameraAspect,
  type CameraStreamRole,
  type CameraViewMode,
  type Device,
  type DeviceKind,
} from '@smartosa/core';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {CameraTile} from './CameraTile';
import {ASPECT_LABEL, DEVICE_KIND_LABEL, VIEW_MODE_LABEL} from './labels';
import styles from './DeviceEditScreen.module.css';

const VIEW_MODES: CameraViewMode[] = ['snapshot', 'mjpeg', 'iframe', 'go2rtc', 'external'];

function emptyDevice(kind: DeviceKind, now: number): Device {
  const base = {id: createId(), name: '', room: '', createdAt: now, updatedAt: now};
  if (kind === 'camera') {
    return {
      ...base,
      kind: 'camera',
      viewMode: 'snapshot',
      rtspUrl: '',
      go2rtcName: 'camera1',
      mainRtspUrl: '',
      mainGo2rtcName: '',
      aspect: 'native',
      snapshotUrl: '',
      mjpegUrl: '',
      iframeUrl: '',
      onvifHost: '{wan}',
      onvifPort: 13554,
    };
  }
  if (kind === 'iframe') {
    return {...base, kind: 'iframe', url: 'http://{lan}/'};
  }
  return {...base, kind: 'link', url: 'http://{wan}/'};
}

export function DeviceEditScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const {ready, devices, settings, repo, reload} = useHomeData();
  const id = params.get('id');
  const kindParam = (params.get('kind') as DeviceKind | null) ?? 'camera';
  const existing = useMemo(() => devices.find((device) => device.id === id) ?? null, [devices, id]);
  const [draft, setDraft] = useState<Device | null>(null);
  const [go2rtcMessage, setGo2rtcMessage] = useState('');

  useEffect(() => {
    if (!ready || draft) {
      return;
    }
    if (existing) {
      setDraft(existing);
      return;
    }
    if (!id) {
      setDraft(emptyDevice(kindParam, Date.now()));
    }
  }, [draft, existing, id, kindParam, ready]);

  useTargetVisit('device', existing?.id ?? null, existing?.name ?? null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !draft.name.trim()) {
      return;
    }
    const saved = {...draft, name: draft.name.trim(), updatedAt: Date.now()};
    await repo.upsertDevice(saved);
    await reload();
    router.push('/devices');
  }

  async function publishToGo2rtc(role: CameraStreamRole = 'preview') {
    if (!draft || draft.kind !== 'camera') {
      return;
    }
    const rtspUrl = role === 'main' ? draft.mainRtspUrl?.trim() || preferRtspMainstream(draft.rtspUrl ?? '') : draft.rtspUrl?.trim();
    if (!rtspUrl) {
      setGo2rtcMessage('Сначала вставьте RTSP URL');
      return;
    }
    const name = role === 'main' ? cameraStreamName(draft, 'main') : draft.go2rtcName?.trim() || 'camera1';
    try {
      const response = await fetch(go2rtcPublishUrl(settings, name, rtspUrl, role), {method: 'PUT'});
      if (!response.ok) {
        throw new Error(`go2rtc ответил ${response.status}`);
      }
      setDraft({
        ...draft,
        viewMode: 'go2rtc',
        ...(role === 'main'
          ? {mainGo2rtcName: name, mainRtspUrl: rtspUrl}
          : {go2rtcName: name}),
      });
      setGo2rtcMessage(
        role === 'main'
          ? 'Главный поток отдан в go2rtc. Он используется на странице одной камеры.'
          : 'Дополнительный поток отдан в go2rtc. Он используется на стене и в превью.',
      );
    } catch (error) {
      const hint = error instanceof Error ? error.message : 'ошибка';
      setGo2rtcMessage(`Не достучались до go2rtc (${hint}). Запустите pnpm go2rtc:up`);
    }
  }

  async function onDelete() {
    if (!draft || !existing) {
      return;
    }
    if (!window.confirm(`Удалить «${draft.name}»?`)) {
      return;
    }
    await repo.deleteDevice(draft.id);
    await reload();
    router.push('/devices');
  }

  if (!ready || !draft) {
    return <p>{ready && id && !existing ? 'Устройство не найдено' : 'Загрузка…'}</p>;
  }

  const openUrl = deviceOpenUrl(draft, settings);

  return (
    <div>
      <PageHeader
        description="RTSP можно сохранить, но в браузере он не играет. Для картинки нужен HTTP snapshot / MJPEG / морда."
        title={existing ? draft.name : `Новое: ${DEVICE_KIND_LABEL[draft.kind]}`}
      />
      <div className={styles.layout}>
        <Card>
          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.section}>
              <h3>Основное</h3>
              <Field hint="Как камера или устройство называется в списке" label="Название">
                <TextInput
                  onChange={(event) => setDraft({...draft, name: event.target.value})}
                  placeholder="Огород"
                  required
                  value={draft.name}
                />
              </Field>
              <Field hint="Группировка на главной, например Дача или Гараж" label="Комната">
                <TextInput
                  onChange={(event) => setDraft({...draft, room: event.target.value})}
                  placeholder="Дача"
                  value={draft.room ?? ''}
                />
              </Field>
            </div>
            {draft.kind === 'camera' ? (
              <>
                <div className={styles.section}>
                  <h3>Поток</h3>
                  <Field
                    hint="Дополнительный поток для стены и превью. Обычно subtype=1."
                    label="RTSP для стены и превью"
                  >
                    <TextInput
                      onChange={(event) => {
                        const rtspUrl = event.target.value;
                        const snapshotGuess = suggestSnapshotFromRtsp(rtspUrl);
                        setDraft({
                          ...draft,
                          rtspUrl,
                          snapshotUrl:
                            snapshotGuess && !draft.snapshotUrl ? snapshotGuess : draft.snapshotUrl,
                        });
                      }}
                      placeholder="rtsp://user:pass@{wan}:10554/cam/realmonitor?channel=1&subtype=1"
                      value={draft.rtspUrl ?? ''}
                    />
                  </Field>
                  <Field
                    hint="Имя лёгкого потока в go2rtc, например camera3."
                    label="Имя превью в go2rtc"
                  >
                    <TextInput
                      onChange={(event) => setDraft({...draft, go2rtcName: event.target.value})}
                      placeholder="camera1"
                      value={draft.go2rtcName ?? 'camera1'}
                    />
                  </Field>
                  <Field
                    hint="Главный поток для страницы одной камеры. Обычно subtype=0."
                    label="RTSP для одной камеры"
                  >
                    <TextInput
                      onChange={(event) => setDraft({...draft, mainRtspUrl: event.target.value})}
                      placeholder="subtype=0"
                      value={draft.mainRtspUrl ?? ''}
                    />
                  </Field>
                  <Field
                    hint="Отдельное имя в go2rtc. Если пусто — к имени превью добавится -main."
                    label="Имя главной камеры в go2rtc"
                  >
                    <TextInput
                      onChange={(event) => setDraft({...draft, mainGo2rtcName: event.target.value})}
                      placeholder={`${draft.go2rtcName?.trim() || 'camera1'}-main`}
                      value={draft.mainGo2rtcName ?? ''}
                    />
                  </Field>
                  <div className={styles.actions}>
                    <Button
                      onClick={() => {
                        const mainRtspUrl = preferRtspMainstream(draft.rtspUrl ?? '');
                        if (mainRtspUrl) {
                          setDraft({...draft, mainRtspUrl});
                        }
                      }}
                      variant="ghost"
                    >
                      Главный поток из превью
                    </Button>
                    <Button onClick={() => void publishToGo2rtc('preview')} variant="ghost">
                      Отдать превью в go2rtc
                    </Button>
                    <Button onClick={() => void publishToGo2rtc('main')} variant="ghost">
                      Отдать главную в go2rtc
                    </Button>
                    <Button href={go2rtcBaseUrl(settings)} rel="noreferrer" target="_blank" variant="ghost">
                      Открыть go2rtc
                    </Button>
                    {suggestSnapshotFromRtsp(draft.rtspUrl ?? '') ? (
                      <Button
                        onClick={() => {
                          const snapshotUrl = suggestSnapshotFromRtsp(draft.rtspUrl ?? '');
                          if (snapshotUrl) {
                            setDraft({...draft, snapshotUrl, viewMode: 'snapshot'});
                          }
                        }}
                        variant="ghost"
                      >
                        HTTP snapshot из RTSP
                      </Button>
                    ) : null}
                  </div>
                  {go2rtcMessage ? <p className={styles.note}>{go2rtcMessage}</p> : null}
                </div>
                <div className={styles.section}>
                  <h3>Как показывать</h3>
                  <Field
                    hint="«Как пришло» не растягивает кадр. Остальные варианты принудительно задают пропорцию."
                    label="Пропорция кадра"
                  >
                    <Select
                      onChange={(event) => setDraft({...draft, aspect: event.target.value as CameraAspect})}
                      value={draft.aspect ?? 'native'}
                    >
                      {(Object.keys(ASPECT_LABEL) as CameraAspect[]).map((aspect) => (
                        <option key={aspect} value={aspect}>
                          {ASPECT_LABEL[aspect]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field hint="Живое видео — режим go2rtc, если шлюз запущен" label="Режим в браузере">
                    <Select
                      onChange={(event) =>
                        setDraft({...draft, viewMode: event.target.value as CameraViewMode})
                      }
                      value={draft.viewMode}
                    >
                      {VIEW_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {VIEW_MODE_LABEL[mode]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    hint="Только http://… Chrome не открывает снимок с логином в URL."
                    label="Snapshot URL"
                  >
                    <TextInput
                      onChange={(event) => {
                        const value = event.target.value;
                        if (isRtspUrl(value)) {
                          setDraft({
                            ...draft,
                            rtspUrl: value,
                            snapshotUrl: suggestSnapshotFromRtsp(value) ?? '',
                          });
                          return;
                        }
                        setDraft({...draft, snapshotUrl: value});
                      }}
                      placeholder="http://{wan}/cgi-bin/snapshot.cgi?channel=1"
                      value={draft.snapshotUrl ?? ''}
                    />
                  </Field>
                  <Field hint="Необязательно. Поток Motion JPEG, если камера его отдаёт" label="MJPEG URL">
                    <TextInput
                      onChange={(event) => setDraft({...draft, mjpegUrl: event.target.value})}
                      placeholder="http://{wan}/cgi-bin/mjpg/video.cgi"
                      value={draft.mjpegUrl ?? ''}
                    />
                  </Field>
                  <Field hint="Штатная веб-морда камеры, если открываете её в iframe" label="Iframe URL">
                    <TextInput
                      onChange={(event) => setDraft({...draft, iframeUrl: event.target.value})}
                      placeholder="http://{lan}/"
                      value={draft.iframeUrl ?? ''}
                    />
                  </Field>
                </div>
                <div className={styles.section}>
                  <h3>ONVIF</h3>
                  <div className={styles.row}>
                    <Field hint="Можно {lan} или {wan}" label="Хост">
                      <TextInput
                        onChange={(event) => setDraft({...draft, onvifHost: event.target.value})}
                        placeholder="{wan}"
                        value={draft.onvifHost ?? ''}
                      />
                    </Field>
                    <Field hint="Проброс порта камеры" label="Порт">
                      <TextInput
                        inputMode="numeric"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            onvifPort: event.target.value ? Number(event.target.value) : undefined,
                          })
                        }
                        placeholder="13554"
                        value={draft.onvifPort ?? ''}
                      />
                    </Field>
                  </div>
                </div>
              </>
            ) : (
              <Field hint="Если сайт запрещает встраивание, панель предложит открыть его в новой вкладке" label="URL">
                <TextInput
                  onChange={(event) => setDraft({...draft, url: event.target.value})}
                  placeholder="http://{lan}/"
                  required
                  value={draft.kind === 'iframe' || draft.kind === 'link' ? draft.url : ''}
                />
              </Field>
            )}
            <div className={styles.actions}>
              <Button type="submit">Сохранить</Button>
              {draft.kind === 'camera' && existing ? (
                <Button href={`/devices/view?id=${draft.id}`} variant="ghost">
                  Одна камера
                </Button>
              ) : null}
              {openUrl ? (
                <Button href={openUrl} rel="noreferrer" target="_blank" variant="ghost">
                  Открыть снаружи
                </Button>
              ) : null}
              {existing ? (
                <Button onClick={onDelete} variant="danger">
                  Удалить
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        <Card className={styles.preview}>
          <h2>Просмотр</h2>
          {draft.kind === 'camera' ? (
            <CameraTile controls={false} device={draft} settings={settings} />
          ) : null}
          {draft.kind === 'iframe' && openUrl ? (
            <EmbedFrame allow="fullscreen" className={styles.previewFrame} src={openUrl} title={draft.name} />
          ) : null}
          {draft.kind === 'link' && openUrl ? (
            <p>
              Ссылка откроется снаружи:{' '}
              <a href={openUrl} rel="noreferrer" target="_blank">
                {openUrl}
              </a>
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
