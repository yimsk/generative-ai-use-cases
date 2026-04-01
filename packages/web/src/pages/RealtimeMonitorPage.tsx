import React, { useCallback, useState } from 'react';
import MonitorSessionView from '../components/RealtimeMonitor/MonitorSessionView';
import MonitorSetup, {
  type MonitorConfig,
} from '../components/RealtimeMonitor/MonitorSetup';
import { useRealtimeMonitorSession } from '../hooks/useRealtimeMonitorSession';

type MonitorPhase = 'idle' | 'recording' | 'stopped';

type SessionProps = {
  config: MonitorConfig;
  phase: Exclude<MonitorPhase, 'idle'>;
  onStop: () => void;
  onClear: () => void;
  onRestart: () => void;
};

const MonitorSession: React.FC<SessionProps> = ({
  config,
  phase,
  onStop,
  onClear,
  onRestart,
}) => {
  const {
    clientReady,
    contextValues,
    error,
    handleStop,
    isEnglishMode,
    isUpdating,
    segments,
    setContextValues,
    setIsEnglishMode,
    systemGeneratedContext,
    translationContext,
    topicEn,
    topicJa,
  } = useRealtimeMonitorSession({ config, phase, onStop });

  return (
    <MonitorSessionView
      clientReady={clientReady}
      config={config}
      contextValues={contextValues}
      error={error}
      isEnglishMode={isEnglishMode}
      isUpdating={isUpdating}
      phase={phase}
      segments={segments}
      systemGeneratedContext={systemGeneratedContext}
      translationContext={translationContext}
      topicEn={topicEn}
      topicJa={topicJa}
      onClear={onClear}
      onContextValuesChange={setContextValues}
      onRestart={onRestart}
      onStop={handleStop}
      onToggleLanguage={setIsEnglishMode}
    />
  );
};

const RealtimeMonitorPage: React.FC = () => {
  const [phase, setPhase] = useState<MonitorPhase>('idle');
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  const handleStart = useCallback((nextConfig: MonitorConfig) => {
    setConfig(nextConfig);
    setSessionKey((current) => current + 1);
    setPhase('recording');
  }, []);

  const handleClear = useCallback(() => {
    setConfig(null);
    setSessionKey((current) => current + 1);
    setPhase('idle');
  }, []);

  const handleStop = useCallback(() => {
    setPhase('stopped');
  }, []);

  const handleRestart = useCallback(() => {
    setSessionKey((current) => current + 1);
    setPhase('recording');
  }, []);

  if (phase === 'idle' || !config) {
    return <MonitorSetup onStart={handleStart} />;
  }

  return (
    <MonitorSession
      key={sessionKey}
      config={config}
      phase={phase}
      onStop={handleStop}
      onClear={handleClear}
      onRestart={handleRestart}
    />
  );
};

export default RealtimeMonitorPage;
