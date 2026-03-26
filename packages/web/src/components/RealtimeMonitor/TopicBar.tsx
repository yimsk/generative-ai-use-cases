import React from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  topic?: string;
  topicJa?: string;
  topicEn?: string;
  isUpdating: boolean;
  isEnglishMode: boolean;
};

const TopicBar: React.FC<Props> = ({
  topic = '',
  topicJa,
  topicEn,
  isUpdating,
  isEnglishMode,
}) => {
  const { t } = useTranslation();
  const displayedTopic = isEnglishMode
    ? (topicEn ?? topic)
    : (topicJa ?? topic);

  return (
    <div className="border-b border-gray-700 bg-gray-800 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-300">
          {t('monitor.current_topic')}
        </span>
        {isUpdating && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-500 border-t-blue-400" />
        )}
        <span className="truncate text-base font-semibold text-white">
          {displayedTopic || t('monitor.detecting_topic')}
        </span>
      </div>
    </div>
  );
};

export default TopicBar;
