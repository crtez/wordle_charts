import { useMemo, type ComponentProps } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Treemap} from 'recharts';
import { format, parseISO } from 'date-fns';
import { CustomTooltip } from '@/components/CustomTooltip';
import { ChartState, PersonalData } from '@/types/wordle_types';
import { FirstGuessData } from '@/services/wordleDataProcessing';

const CHART_CONFIG = {
  yAxisDomains: {
    personal: [-3, 3],
    difference: [-0.75, 0.5],
    default: [2.5, 6],
    rolling: [3.25, 4.5],
    clairvoyant: [0, 1.7]
  },
  yAxisTicks: {
    personal: [-3, -2, -1, 0, 1, 2, 3],
    difference: [-0.75, -0.5, -0.25, 0, 0.25, 0.5],
    default: [2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    rolling: [3.25, 3.5, 3.75, 4, 4.25, 4.5],
    clairvoyant: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]
  }
};

type TreemapMouseHandler = NonNullable<ComponentProps<typeof Treemap>['onMouseEnter']>;

export type ChartMode = 'standard' | 'difference' | 'personal' | 'rolling7' | 'rolling30' | 'firstGuess' | 'clairvoyant';

interface WordleChartsProps {
  chartMode: ChartMode;
  displayData: ChartState['displayData'];
  firstGuessData: FirstGuessData[];
  personalData: PersonalData[];
  isHardMode: boolean;
  showWords: boolean;
  cumulativeAverage: number;
  foundWordIndex: number | null;
  selectedDate?: Date;
  selectedEndDate?: Date;
  handleTreemapMouseEnter: TreemapMouseHandler;
}

// Split out of App so recharts (~117KB gzipped) loads lazily instead of blocking first paint.
const WordleCharts = ({
  chartMode,
  displayData,
  firstGuessData,
  personalData,
  isHardMode,
  showWords,
  cumulativeAverage,
  foundWordIndex,
  selectedDate,
  selectedEndDate,
  handleTreemapMouseEnter,
}: WordleChartsProps) => {
  // Memoized so the ~1200-point array isn't rebuilt on unrelated re-renders.
  const coloredData = useMemo(
    () =>
      displayData.map((entry, index) => ({
        ...entry,
        fill: index === foundWordIndex ? "#ff0000" : "#2563eb"
      })),
    [displayData, foundWordIndex]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      {chartMode === 'firstGuess' ? (
        <Treemap
          data={firstGuessData}
          dataKey="size"
          nameKey="name"
          aspectRatio={4 / 3}
          stroke="#fff"
          fill="#2563eb"
          onMouseEnter={handleTreemapMouseEnter}
        >
          <Tooltip
            content={(props) => (
              <CustomTooltip 
                {...props} 
                chartMode={chartMode} 
                personalData={personalData} 
                firstGuessData={firstGuessData}
              />
            )}
          />
        </Treemap>
      ) : (
        <ScatterChart 
          margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={showWords ? "word" : "date"}
            angle={-45}
            interval="preserveStart"
            textAnchor="end"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => showWords ? value : format(parseISO(value), 'M/d/yyyy')}
            style={{ userSelect: 'none' }}
          />
          <YAxis
            domain={chartMode === 'clairvoyant' ? CHART_CONFIG.yAxisDomains.clairvoyant :
                   chartMode === 'personal' ? CHART_CONFIG.yAxisDomains.personal :
                   chartMode === 'difference' ? CHART_CONFIG.yAxisDomains.difference :
                   chartMode.startsWith('rolling') ? CHART_CONFIG.yAxisDomains.rolling :
                   CHART_CONFIG.yAxisDomains.default}
            ticks={chartMode === 'clairvoyant' ? CHART_CONFIG.yAxisTicks.clairvoyant :
                   chartMode === 'personal' ? CHART_CONFIG.yAxisTicks.personal :
                   chartMode === 'difference' ? CHART_CONFIG.yAxisTicks.difference :
                   chartMode.startsWith('rolling') ? CHART_CONFIG.yAxisTicks.rolling :
                   CHART_CONFIG.yAxisTicks.default}
            tickFormatter={(value) => value.toFixed(2)}
            label={{ 
              value: chartMode === 'clairvoyant' ? 'Proportion Delta' :
                     chartMode === 'difference' || chartMode === 'personal' ? 'Difference in Guesses' : 'Average Guesses', 
              angle: -90, 
              position: 'insideLeft',
              style: { userSelect: 'none' }
            }}
            style={{ userSelect: 'none' }}
          />
          <Tooltip 
            content={(props) => (
              <CustomTooltip 
                {...props} 
                chartMode={chartMode} 
                personalData={personalData}
                isHardMode={isHardMode}
              />
            )} 
          />
          {(chartMode === 'standard' || chartMode.startsWith('rolling')) && (
            <ReferenceLine 
            y={cumulativeAverage} 
            stroke="#666"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{
              value: `Avg: ${cumulativeAverage.toFixed(2)}`,
              position: 'left',
              fill: '#666',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          />
          )}
          <Scatter 
            name="Wordle Data"
            data={coloredData}
            fill="#2563eb"
            line={chartMode === 'rolling7' || chartMode === 'rolling30'}
            shape="circle"
            isAnimationActive={false}
            dataKey={
              chartMode === 'clairvoyant' ? (isHardMode ? 'hardProportionDelta' : 'proportionDelta') :
              chartMode === 'difference' ? 'difference' : 
              chartMode === 'personal' ? (isHardMode ? 'personalDifferenceHard' : 'personalDifference') :
              chartMode.startsWith('rolling') ? (isHardMode ? 'rollingAverageHard' : 'rollingAverage') :
              isHardMode ? 'hardAverage' : 'average'
            }
          />

          {/* Add the word pointer */}
          {foundWordIndex !== null && (
            <ReferenceLine
              key={`${chartMode}-${selectedDate?.toISOString()}-${selectedEndDate?.toISOString()}-${foundWordIndex}`}
              x={displayData[foundWordIndex]?.[showWords ? 'word' : 'date']}
              stroke="red"
              strokeWidth={2}
              className="animate-flash"
              isFront={true}
            />
          )}
        </ScatterChart>
      )}
    </ResponsiveContainer>
  );
};

export default WordleCharts;
