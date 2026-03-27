import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  checked: boolean;
  onSwitch: (value: boolean) => void;
};

const LanguageToggle: React.FC<Props> = ({ checked, onSwitch }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onSwitch(!checked)}
      className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-slate-900/90 px-4 py-2 text-xs font-medium text-slate-100 shadow-lg shadow-slate-950/40 backdrop-blur-sm transition hover:border-cyan-300/35 hover:bg-slate-800">
      <span>{t('monitor.display_language')}</span>
      <span
        className={[
          'inline-flex min-w-11 justify-center rounded-full px-2 py-0.5 text-[11px]',
          checked
            ? 'bg-cyan-400 text-slate-950'
            : 'bg-slate-700 text-slate-200',
        ].join(' ')}>
        {checked ? 'EN' : 'JP'}
      </span>
    </button>
  );
};

export default LanguageToggle;
