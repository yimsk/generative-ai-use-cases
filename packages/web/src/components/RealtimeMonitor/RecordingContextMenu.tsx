import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StructuredContextForm, { type StructuredContextValues } from './StructuredContextForm';

type Props = {
  values: StructuredContextValues;
  onChange: (values: StructuredContextValues) => void;
  systemGeneratedContext?: string;
};

const RecordingContextMenu: React.FC<Props> = ({ values, onChange, systemGeneratedContext }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600"
      >
        {t('monitor.edit_context')}
      </button>

      {isOpen && (
        <div className="absolute right-4 top-12 z-50 w-80 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl">
          <StructuredContextForm values={values} onChange={onChange} />
          {systemGeneratedContext !== undefined && (
            <div className="mt-4">
              <label
                htmlFor="systemGeneratedContext"
                className="text-sm font-medium text-gray-700"
              >
                {t('monitor.system_generated_context')}
              </label>
              <textarea
                id="systemGeneratedContext"
                className="mt-1 w-full rounded border border-black/30 p-2 text-sm opacity-60"
                value={systemGeneratedContext}
                rows={4}
                readOnly
                placeholder={t('monitor.system_generated_context_placeholder')}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default RecordingContextMenu;
