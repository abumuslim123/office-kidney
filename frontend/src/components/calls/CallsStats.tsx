import React from 'react';
import { formatSeconds } from './calls-types';
import type { CallStats as CallStatsType } from './calls-types';

type CallsStatsProps = {
  stats: CallStatsType;
};

function CallsStats({ stats }: CallsStatsProps) {
  return (
    <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-3 bg-white border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500">Всего</div>
        <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.totalCalls}</div>
      </div>
      <div className="p-3 bg-white border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500">Сотрудники</div>
        <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.totalEmployees}</div>
      </div>
      <div className="p-3 bg-white border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500">Клиенты</div>
        <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.totalClients}</div>
      </div>
      <div className="p-3 bg-white border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500">Общая длительность</div>
        <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatSeconds(stats.totalDurationSeconds)}</div>
      </div>
      <div className="p-3 bg-white border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500">Ср. речь</div>
        <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatSeconds(stats.avgSpeechDurationSeconds)}</div>
      </div>
      <div className="p-3 bg-white border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500">Ср. молчание</div>
        <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatSeconds(stats.avgSilenceDurationSeconds)}</div>
      </div>
    </div>
  );
}

export default React.memo(CallsStats);
