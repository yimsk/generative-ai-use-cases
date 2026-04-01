import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StructuredContextForm, {
  type StructuredContextValues,
} from './StructuredContextForm';

type Props = {
  values: StructuredContextValues;
  onChange: (values: StructuredContextValues) => void;
  systemGeneratedContext?: string;
  translationContext?: string;
};

const RecordingContextMenu: React.FC<Props> = ({
  values,
  onChange,
  systemGeneratedContext,
  translationContext,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-600">
        {t('monitor.edit_context')}
      </button>

      {isOpen && (
        <div className="absolute right-4 top-12 z-50 w-80 rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-xl">
          <StructuredContextForm values={values} onChange={onChange} />
          {systemGeneratedContext?.trim() && (
            <div className="mt-4">
              <label
                htmlFor="systemGeneratedContext"
                className="text-sm font-medium text-gray-300">
                {t('monitor.system_generated_context')}
              </label>
              <textarea
                id="systemGeneratedContext"
                className="mt-1 w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-100 placeholder:text-gray-500"
                value={systemGeneratedContext}
                rows={4}
                readOnly
                placeholder={t('monitor.system_generated_context_placeholder')}
              />
            </div>
          )}
          <div className="mt-4">
            <label
              htmlFor="translationContext"
              className="text-sm font-medium text-gray-300">
              {t('monitor.translation_context')}
            </label>
            <textarea
              id="translationContext"
              className="mt-1 w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-100 placeholder:text-gray-500"
              value={translationContext ?? ''}
              rows={8}
              readOnly
              placeholder={t('monitor.translation_context_placeholder')}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default RecordingContextMenu;
