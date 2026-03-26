import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StructuredContextForm, { type StructuredContextValues } from './StructuredContextForm';

type Props = {
  values: StructuredContextValues;
  onChange: (values: StructuredContextValues) => void;
};

const RecordingContextMenu: React.FC<Props> = ({ values, onChange }) => {
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
        </div>
      )}
    </>
  );
};

export default RecordingContextMenu;
