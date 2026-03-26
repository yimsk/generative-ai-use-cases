import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  topic: string;
  isUpdating: boolean;
  isEnglishMode: boolean;
};

const TopicBar: React.FC<Props> = ({ topic, isUpdating }) => {
  const { t } = useTranslation();

  return (
    <div className="border-b border-gray-700 bg-gray-800 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-300">
          {t('monitor.current_topic')}
        </span>
        {isUpdating && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-500 border-t-blue-400" />
        )}
        <span className="text-base font-semibold text-white truncate">
          {topic || t('monitor.detecting_topic')}
        </span>
      </div>
    </div>
  );
};

export default TopicBar;
