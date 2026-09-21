import {
  bustCacheUrl,
  browserRtspSource,
  cameraPreviewUrl,
  cameraWebUrls,
  go2rtcBaseUrl,
  go2rtcPlayerUrl,
  go2rtcVideoUrl,
  hasEmbeddedUserinfo,
  isRtspUrl,
  preferRtspSubstream,
  resolveHostTemplate,
  suggestSnapshotFromRtsp,
} from './urls';

describe('urls', () => {
  it('follows the page host when go2rtc is saved as localhost', () => {
    const previous = global.window;
    global.window = {location: {hostname: '192.168.1.20'}} as unknown as Window & typeof globalThis.window;
    expect(
      go2rtcBaseUrl({lanHost: '', wanHost: '', go2rtcUrl: 'http://127.0.0.1:1984'}),
    ).toBe('http://192.168.1.20:1984');
    global.window = previous;
  });

  it('substitutes lan and wan hosts', () => {
    expect(
      resolveHostTemplate('http://{lan}:8080/snap http://{wan}:80/ui', {
        lanHost: '192.168.1.10',
        wanHost: '185.199.162.89',
        go2rtcUrl: 'http://127.0.0.1:1984',
      }),
    ).toBe('http://192.168.1.10:8080/snap http://185.199.162.89:80/ui');
  });

  it('adds a cache buster', () => {
    expect(bustCacheUrl('http://cam/snap', 42)).toBe('http://cam/snap?t=42');
    expect(bustCacheUrl('http://cam/snap?n=1', 42)).toBe('http://cam/snap?n=1&t=42');
  });

  it('detects RTSP and guesses a Dahua HTTP snapshot', () => {
    const rtsp =
      'rtsp://user:secret@185.199.162.89:10554/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif';
    expect(isRtspUrl(rtsp)).toBe(true);
    expect(suggestSnapshotFromRtsp(rtsp)).toBe(
      'http://user:secret@185.199.162.89/cgi-bin/snapshot.cgi?channel=1',
    );
    expect(
      suggestSnapshotFromRtsp('rtsp://user:secret@{wan}:10554/cam/realmonitor?channel=1&subtype=0'),
    ).toBe('http://user:secret@{wan}/cgi-bin/snapshot.cgi?channel=1');
  });

  it('switches Dahua RTSP to the substream', () => {
    expect(
      preferRtspSubstream(
        'rtsp://user:secret@host:10554/cam/realmonitor?channel=1&subtype=0&unicast=true',
      ),
    ).toBe('rtsp://user:secret@host:10554/cam/realmonitor?channel=1&subtype=1&unicast=true');
    expect(browserRtspSource('rtsp://user:secret@host/cam/realmonitor?channel=1&subtype=0')).toBe(
      'rtsp://user:secret@host/cam/realmonitor?channel=1&subtype=1#media=video#timeout=60',
    );
    expect(browserRtspSource('rtsp://user:secret@host/cam/realmonitor?channel=1&subtype=1', 'main')).toBe(
      'rtsp://user:secret@host/cam/realmonitor?channel=1&subtype=0#media=video#timeout=60',
    );
  });

  it('builds a go2rtc mp4 URL', () => {
    expect(
      go2rtcVideoUrl(
        {
          id: 'c1',
          kind: 'camera',
          name: 'Cam',
          viewMode: 'go2rtc',
          go2rtcName: 'camera1',
          createdAt: 1,
          updatedAt: 1,
        },
        {lanHost: '', wanHost: '', go2rtcUrl: 'http://127.0.0.1:1984/'},
      ),
    ).toBe('http://127.0.0.1:1984/api/stream.mp4?src=camera1');
  });

  it('builds a go2rtc player URL', () => {
    expect(
      go2rtcPlayerUrl(
        {
          id: 'c1',
          kind: 'camera',
          name: 'Cam',
          viewMode: 'go2rtc',
          go2rtcName: 'camera1',
          createdAt: 1,
          updatedAt: 1,
        },
        {lanHost: '', wanHost: '', go2rtcUrl: 'http://127.0.0.1:1984/'},
      ),
    ).toBe('/camera-player.html?go2rtc=http%3A%2F%2F127.0.0.1%3A1984&src=camera1&fit=contain');
  });

  it('does not send credentialed snapshot URLs to the browser', () => {
    expect(hasEmbeddedUserinfo('http://user:secret@185.199.162.89/cgi-bin/snapshot.cgi')).toBe(true);
    expect(hasEmbeddedUserinfo('http://127.0.0.1:1984/api/frame.jpeg?src=camera4')).toBe(false);
    expect(
      cameraPreviewUrl(
        {
          id: 'c4',
          kind: 'camera',
          name: 'Cam',
          viewMode: 'snapshot',
          go2rtcName: 'camera4',
          snapshotUrl: 'http://user:secret@{wan}/cgi-bin/snapshot.cgi?channel=1',
          createdAt: 1,
          updatedAt: 1,
        },
        {lanHost: '', wanHost: '185.199.162.89', go2rtcUrl: 'http://127.0.0.1:1984'},
      ),
    ).toBe('http://127.0.0.1:1984/api/frame.jpeg?src=camera4');
  });

  it('lists camera web UI addresses when they are set', () => {
    const settings = {lanHost: '192.168.1.10', wanHost: '185.199.162.89', go2rtcUrl: 'http://127.0.0.1:1984'};
    const camera = {
      id: 'c1',
      kind: 'camera' as const,
      name: 'Cam',
      viewMode: 'go2rtc' as const,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(cameraWebUrls({...camera, onvifHost: '{wan}', onvifPort: 12554}, settings)).toEqual([
      {label: 'Веб-морда', href: 'http://185.199.162.89:12554/'},
    ]);
    expect(
      cameraWebUrls(
        {...camera, iframeUrl: 'http://{lan}/', onvifHost: '{wan}', onvifPort: 12554},
        settings,
      ),
    ).toEqual([
      {label: 'Веб-морда', href: 'http://192.168.1.10/'},
      {label: 'ONVIF', href: 'http://185.199.162.89:12554/'},
    ]);
    expect(cameraWebUrls(camera, settings)).toEqual([]);
  });
});
