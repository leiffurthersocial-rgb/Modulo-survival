import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { GameSession } from './session';
import { debugAllowed, loadSettings, saveSettings, type Settings } from './settings';
import { DeathScreen, LoadScreen, NewGameScreen, SettingsScreen, TitleScreen } from './screens';
import { Hud } from './Hud';
import { useSession } from './common';
import { InventoryPanel } from './panels/InventoryPanel';
import { BuildPanel, CraftPanel } from './panels/CraftBuildPanels';
import { MapPanel } from './panels/MapPanel';
import { CharacterPanel, GroupPanel } from './panels/PeoplePanels';
import { CampPanel, DocReader, JournalPanel, MenuPanel } from './panels/InfoPanels';
import { TouchControls } from './TouchControls';
import { DebugPanel } from './DebugPanel';
import { generateWorld } from '@/gen/world';
import { listSaves, loadGame, type SlotId } from '@/save/storage';
import type { GameMode, GameState } from '@/sim/types';
import { audio } from '@/audio/audio';
import { log } from '@/core/logger';

type Screen = 'title' | 'new' | 'load' | 'settings' | 'game';

class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    log.error('ui', error.message, error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="screen">
          <div className="title-screen">
            <h2 className="bad">Something went wrong</h2>
            <pre style={{ maxWidth: 600, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
            <button onClick={() => (this.setState({ error: undefined }), this.props.onReset())}>Back to title</button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

function GameView(props: { state: GameState; settings: Settings; onSettings: (s: Settings) => void; onQuit: () => void; onLoad: (slot: SlotId) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  useEffect(() => {
    const s = new GameSession(props.state, host.current!, props.settings);
    s.start();
    setSession(s);
    if (debugAllowed()) (window as unknown as { __game?: GameSession }).__game = s;
    return () => s.destroy();
    // the session lives for this state object only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.state]);
  useEffect(() => {
    session?.applySettings(props.settings);
  }, [session, props.settings]);
  return (
    <div className="game-root" ref={host}>
      {session && <GameUI session={session} {...props} />}
    </div>
  );
}

function GameUI(props: { session: GameSession; settings: Settings; onSettings: (s: Settings) => void; onQuit: () => void; onLoad: (slot: SlotId) => void }) {
  const { session } = props;
  useSession(session);
  const ui = session.ui;
  const g = session.game;
  const panel = (() => {
    switch (ui.panel) {
      case 'inventory':
        return <InventoryPanel session={session} />;
      case 'craft':
        return <CraftPanel session={session} />;
      case 'build':
        return <BuildPanel session={session} />;
      case 'map':
        return <MapPanel session={session} />;
      case 'group':
        return <GroupPanel session={session} />;
      case 'character':
        return <CharacterPanel session={session} />;
      case 'journal':
        return <JournalPanel session={session} />;
      case 'camp':
        return <CampPanel session={session} />;
      case 'menu':
        return <MenuPanel session={session} settings={props.settings} onSettings={props.onSettings} onQuit={props.onQuit} onLoad={props.onLoad} />;
      default:
        return null;
    }
  })();
  return (
    <>
      <Hud session={session} />
      {props.settings.touchControls && !ui.panel && <TouchControls session={session} />}
      {panel && (
        <>
          {session.paused && <div className="dim" onClick={() => session.openPanel(null)} />}
          <div className="modal-wrap">{panel}</div>
        </>
      )}
      {ui.doc && <DocReader session={session} />}
      {ui.debug && <DebugPanel session={session} />}
      {ui.dead && (
        <DeathScreen
          name={ui.dead.name}
          cause={ui.dead.cause}
          survivors={g.livingCharacters()}
          onContinue={(id) => session.continueAs(id)}
          onQuit={props.onQuit}
        />
      )}
    </>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [state, setState] = useState<GameState | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    document.documentElement.style.setProperty('--ui', String(settings.uiScale));
  }, [settings.uiScale]);
  useEffect(() => {
    void listSaves().then((l) => setHasSave(l.length > 0));
  }, [screen]);
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }, []);

  const changeSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };
  const load = async (slot: SlotId) => {
    try {
      setErr('');
      const st = await loadGame(slot);
      setState(st);
      setScreen('game');
    } catch (e) {
      setErr((e as Error).message);
      log.error('load', (e as Error).message, e);
    }
  };
  const continueLatest = async () => {
    const l = await listSaves();
    if (l[0]) await load(l[0].slot as SlotId);
  };
  const start = (seed: number, mode: GameMode, playerId: string) => {
    const st = generateWorld({ seed, mode, playerId });
    setState(st);
    setScreen('game');
  };
  const quit = () => {
    setState(null);
    setScreen('title');
  };

  return (
    <ErrorBoundary onReset={quit}>
      {screen === 'title' && (
        <>
          <TitleScreen hasSave={hasSave} onContinue={() => void continueLatest()} onNew={() => setScreen('new')} onLoad={() => setScreen('load')} onSettings={() => setScreen('settings')} />
          {err && (
            <div className="panel" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', padding: 10 }}>
              <span className="bad">Could not load: {err}</span>
            </div>
          )}
        </>
      )}
      {screen === 'settings' && <SettingsScreen settings={settings} onChange={changeSettings} onBack={() => setScreen('title')} />}
      {screen === 'new' && <NewGameScreen onBack={() => setScreen('title')} onStart={start} />}
      {screen === 'load' && (
        <LoadScreen
          onBack={() => setScreen('title')}
          onLoad={(s) => void load(s)}
          onImported={(st) => {
            setState(st);
            setScreen('game');
          }}
        />
      )}
      {screen === 'game' && state && <GameView state={state} settings={settings} onSettings={changeSettings} onQuit={quit} onLoad={(s) => void load(s)} />}
    </ErrorBoundary>
  );
}
