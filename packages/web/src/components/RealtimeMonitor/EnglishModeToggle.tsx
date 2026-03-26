import React from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../Switch';

type Props = {
  isEnglishMode: boolean;
  onChange: (value: boolean) => void;
};

const EnglishModeToggle: React.FC<Props> = ({ isEnglishMode, onChange }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center">
      <Switch
        checked={isEnglishMode}
        onSwitch={onChange}
        label={t('monitor.english_mode')}
      />
    </div>
  );
};

export default EnglishModeToggle;
