import React from 'react';
import { useTranslation } from 'react-i18next';

export type StructuredContextValues = {
  meetingName: string;
  background: string;
};

type Props = {
  values: StructuredContextValues;
  onChange: (values: StructuredContextValues) => void;
  disabled?: boolean;
};

const StructuredContextForm: React.FC<Props> = ({
  values,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  const getCharacterCountColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio > 0.9) return 'text-red-500';
    if (ratio > 0.75) return 'text-amber-500';
    return 'text-gray-400';
  };

  const maxLengths = {
    meetingName: 100,
    background: 2000,
  };

  const handleChange =
    (key: keyof StructuredContextValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const truncated = e.target.value.slice(0, maxLengths[key]);
      onChange({
        ...values,
        [key]: truncated,
      });
    };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="monitor-meeting-name"
          className="text-sm font-medium text-gray-700">
          {t('monitor.meeting_name')}
        </label>
        <input
          id="monitor-meeting-name"
          type="text"
          className="mt-1 w-full rounded border border-black/30 p-2 text-sm disabled:opacity-50"
          value={values.meetingName}
          onChange={handleChange('meetingName')}
          maxLength={maxLengths.meetingName}
          disabled={disabled}
          placeholder={t('monitor.meeting_name_placeholder')}
        />
        <div
          className={`mt-1 text-xs ${getCharacterCountColor(
            values.meetingName.length,
            maxLengths.meetingName
          )}`}>
          {[values.meetingName.length, maxLengths.meetingName].join('/')}
        </div>
      </div>

      <div>
        <label
          htmlFor="monitor-background"
          className="text-sm font-medium text-gray-700">
          {t('monitor.background')}
        </label>
        <textarea
          id="monitor-background"
          className="mt-1 w-full rounded border border-black/30 p-2 text-sm disabled:opacity-50"
          value={values.background}
          onChange={handleChange('background')}
          maxLength={maxLengths.background}
          rows={4}
          disabled={disabled}
          placeholder={t('monitor.background_placeholder')}
        />
        <div
          className={`mt-1 text-xs ${getCharacterCountColor(
            values.background.length,
            maxLengths.background
          )}`}>
          {[values.background.length, maxLengths.background].join('/')}
        </div>
      </div>
    </div>
  );
};

export default StructuredContextForm;
