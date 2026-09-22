'use client';

import {useHomeData} from '@/domains/shell';
import {Button, Card, Field, PageHeader, TextInput} from '@/domains/ui';
import {parseSnapshot, serializeSnapshot} from '@smartosa/core';
import {useEffect, useState, type ChangeEvent, type FormEvent} from 'react';
import {clearPin, hasPin, lockSession, setPin} from './pin';
import styles from './SettingsScreen.module.css';

export function SettingsScreen() {
  const {ready, settings, homes, activeHome, repo, reload} = useHomeData();
  const [lanHost, setLanHost] = useState('');
  const [wanHost, setWanHost] = useState('');
  const [go2rtcUrl, setGo2rtcUrl] = useState('');
  const [pin, setPinValue] = useState('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [homeName, setHomeName] = useState('');

  useEffect(() => {
    if (ready) {
      setLanHost(settings.lanHost);
      setWanHost(settings.wanHost);
      setGo2rtcUrl(settings.go2rtcUrl);
      setPinEnabled(hasPin());
    }
  }, [ready, settings]);

  useEffect(() => {
    if (activeHome) {
      setHomeName(activeHome.name);
    }
  }, [activeHome]);

  async function onRenameHome(event: FormEvent) {
    event.preventDefault();
    if (!activeHome || !homeName.trim()) {
      return;
    }
    await repo.renameHome(activeHome.id, homeName.trim());
    await reload();
    setMessage('Название сохранено');
  }

  async function onDeleteHome() {
    if (!activeHome) {
      return;
    }
    if (!window.confirm(`Удалить дом «${activeHome.name}»? Камеры, стены и адреса этого дома пропадут из браузера.`)) {
      return;
    }
    await repo.deleteHome(activeHome.id);
    await reload();
    setMessage('Дом удалён');
  }

  async function onToggleWatch(checked: boolean) {
    await repo.setSettings({
      lanHost: settings.lanHost,
      wanHost: settings.wanHost,
      go2rtcUrl: settings.go2rtcUrl,
      ...(settings.routerHost ? {routerHost: settings.routerHost} : {}),
      ...(settings.routerUser ? {routerUser: settings.routerUser} : {}),
      ...(settings.routerPassword ? {routerPassword: settings.routerPassword} : {}),
      ...(checked ? {watchFrames: true} : {}),
    });
    await reload();
    setMessage(checked ? 'Слежение включено' : 'Слежение выключено');
  }

  async function onSaveNetwork(event: FormEvent) {
    event.preventDefault();
    await repo.setSettings({
      lanHost: lanHost.trim(),
      wanHost: wanHost.trim(),
      go2rtcUrl: go2rtcUrl.trim() || 'http://127.0.0.1:1984',
      ...(settings.watchFrames ? {watchFrames: true} : {}),
      ...(settings.routerHost ? {routerHost: settings.routerHost} : {}),
      ...(settings.routerUser ? {routerUser: settings.routerUser} : {}),
      ...(settings.routerPassword ? {routerPassword: settings.routerPassword} : {}),
    });
    await reload();
    setMessage('Сеть сохранена');
  }

  async function onSavePin(event: FormEvent) {
    event.preventDefault();
    if (!pin.trim()) {
      return;
    }
    await setPin(pin.trim());
    setPinValue('');
    setPinEnabled(true);
    setMessage('PIN сохранён в этом браузере');
  }

  function onClearPin() {
    clearPin();
    setPinEnabled(false);
    setMessage('PIN снят');
  }

  async function onExport() {
    const snapshot = await repo.exportSnapshot();
    const blob = new Blob([serializeSnapshot(snapshot)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartosa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const parsed = parseSnapshot(await file.text());
      await repo.importSnapshot(parsed);
      await reload();
      setMessage('Конфиг импортирован');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось импортировать');
    }
  }

  return (
    <div>
      <PageHeader
        description={
          activeHome
            ? `Камеры, стены и адреса дома «${activeHome.name}». Другой дом выбирается по названию в меню.`
            : 'Камеры, стены и адреса текущего дома.'
        }
        title="Настройки"
      />
      {!ready ? <p>Загрузка…</p> : null}
      <div className={styles.stack}>
        <Card>
          <div className={styles.blockHead}>
            <h2>{activeHome?.name ?? 'Дом'}</h2>
            <p>Имя только этого дома. Другой дом выбирается по названию слева.</p>
          </div>
          <form className={styles.form} onSubmit={onRenameHome}>
            <Field label="Название">
              <TextInput onChange={(event) => setHomeName(event.target.value)} value={homeName} />
            </Field>
            <div className={styles.row}>
              <Button type="submit">Сохранить название</Button>
              {homes.length > 1 ? (
                <Button onClick={() => void onDeleteHome()} type="button" variant="danger">
                  Удалить дом
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
        <Card>
          <div className={styles.blockHead}>
            <h2>Слежение за кадром</h2>
            <p>
              Пока эта вкладка открыта, панель сравнивает кадры камер через go2rtc. Если картинка изменилась и
              осталась такой, на главной появятся время и два снимка: до и после. Это изменение картинки, без
              имени предмета. Когда компьютер спит или вкладка закрыта, запись останавливается.
            </p>
          </div>
          <label className={styles.pin}>
            <input
              checked={settings.watchFrames === true}
              onChange={(event) => void onToggleWatch(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>Следить, пока панель открыта</strong>
              <small>Нужен запущенный go2rtc. Журнал хранится в этом браузере и в JSON-копию не входит.</small>
            </span>
          </label>
        </Card>
        <Card>
          <div className={styles.blockHead}>
            <h2>Сеть</h2>
            <p>
              Адреса подставляются в ссылки камер и устройств дома «{activeHome?.name ?? 'этот дом'}».
            </p>
          </div>
          <form className={styles.form} onSubmit={onSaveNetwork}>
            <Field hint="Роутер или сервер в локальной сети. Пример: 192.168.1.1" label="LAN — домашний адрес">
              <TextInput
                onChange={(event) => setLanHost(event.target.value)}
                placeholder="192.168.1.1"
                value={lanHost}
              />
            </Field>
            <Field hint="Белый IP, по которому дом доступен из интернета" label="WAN — внешний адрес">
              <TextInput
                onChange={(event) => setWanHost(event.target.value)}
                placeholder="185.199.162.89"
                value={wanHost}
              />
            </Field>
            <Field
              hint="Локальный шлюз RTSP → видео в браузере. Запуск: pnpm go2rtc:up"
              label="go2rtc — адрес видеошлюза"
            >
              <TextInput
                onChange={(event) => setGo2rtcUrl(event.target.value)}
                placeholder="http://127.0.0.1:1984"
                value={go2rtcUrl}
              />
            </Field>
            <div className={styles.row}>
              <Button type="submit">Сохранить сеть</Button>
            </div>
          </form>
        </Card>
        <Card>
          <div className={styles.blockHead}>
            <h2>Доступ к панели</h2>
            <p>Один PIN на весь браузер, общий для всех домов. Это не защита камер и не VPN.</p>
          </div>
          <form className={styles.form} onSubmit={onSavePin}>
            <Field
              hint={pinEnabled ? 'Оставьте пустым, если менять не нужно. Сейчас PIN включён.' : 'Необязательно. После установки панель спросит код при открытии.'}
              label={pinEnabled ? 'Новый PIN' : 'PIN-код'}
            >
              <TextInput
                autoComplete="off"
                inputMode="numeric"
                onChange={(event) => setPinValue(event.target.value)}
                placeholder={pinEnabled ? 'Новый код' : 'Например 1234'}
                type="password"
                value={pin}
              />
            </Field>
            <div className={styles.row}>
              <Button type="submit">Сохранить PIN</Button>
              {pinEnabled ? (
                <>
                  <Button onClick={onClearPin} variant="ghost">
                    Снять PIN
                  </Button>
                  <Button
                    onClick={() => {
                      lockSession();
                      window.location.reload();
                    }}
                    variant="ghost"
                  >
                    Заблокировать
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </Card>
        <Card>
          <div className={styles.blockHead}>
            <h2>Резервная копия</h2>
            <p>
              JSON дома «{activeHome?.name ?? 'этот дом'}» для переноса в другой браузер. PIN в файл не попадает.
            </p>
          </div>
          <div className={styles.row}>
            <Button onClick={onExport} variant="ghost">
              Скачать JSON
            </Button>
            <label className={styles.import}>
              Импорт JSON
              <input accept="application/json" hidden onChange={onImport} type="file" />
            </label>
          </div>
        </Card>
        {message ? <p className={styles.message}>{message}</p> : null}
      </div>
    </div>
  );
}
