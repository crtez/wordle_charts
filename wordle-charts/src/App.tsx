import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useWordleData } from '@/utils/processWordleData';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, RotateCcw } from "lucide-react"
import { InstructionsDialog } from '@/components/InstructionsDialog';
import { DateRangePicker } from '@/components/date-range-picker';
import { subMonths, startOfDay, endOfDay } from 'date-fns';
import { parseISO } from 'date-fns';
import { ChartState, PersonalData, PersonalStats } from '@/types/wordle_types';
import {
  processWordleData,
  calculatePersonalStats,
  calculateRollingAverage,
  getBookmarkletCode,
  calculateFirstGuessFrequency,
  FirstGuessData,
} from '@/services/wordleDataProcessing';
import { ModeToggle } from '@/components/mode-toggle';
import { ThemeProvider } from '@/components/theme-provider';
import { FileInput } from '@/components/FileInput';
import { useCheatingData } from '@/utils/useCheatingData';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import Oneko from '@/components/Oneko';

const WordleCharts = lazy(() => import('@/components/WordleCharts'));

const WordleChart = ({ onHighlightPoint }: { onHighlightPoint: (point: { x: number, y: number } | null) => void }) => {
  // Add searchParams
  const [searchParams, setSearchParams] = useSearchParams();

  // Data and Loading States
  const { data, error } = useWordleData();
  const [personalData, setPersonalData] = useState<PersonalData[]>([]);
  const [firstGuessData, setFirstGuessData] = useState<FirstGuessData[]>([]);
  const { data: cheatingData } = useCheatingData();
  
  // UI Control States
  const [showWords, setShowWords] = useState(false);
  const [isHardMode, setIsHardMode] = useState(false);
  const [chartMode, setChartMode] = useState<'standard' | 'difference' | 'personal' | 'rolling7' | 'rolling30' | 'firstGuess' | 'clairvoyant'>(
    (searchParams.get('chart') as any) || 'standard'
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [showMobileBanner, setShowMobileBanner] = useState(() => {
    return localStorage.getItem('hideMobileBanner') !== 'true';
  });
  const [fileName, setFileName] = useState<string>("Upload your .json file here! 🙂");

  // Date States
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const fromDate = searchParams.get('from');
    return fromDate ? startOfDay(parseISO(fromDate)) : undefined;
  });

  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(() => {
    const toDate = searchParams.get('to');
    return toDate ? endOfDay(parseISO(toDate)) : undefined;
  });
  const minDate = useMemo(() => 
    data?.length ? parseISO(data[0].date) : subMonths(new Date(), 12), 
    [data]
  );
  const maxDate = useMemo(() => 
    data?.length ? parseISO(data[data.length - 1].date) : new Date(), 
    [data]
  );

  // Chart Data States
  const [chartState, setChartState] = useState<ChartState>({
    allData: {
      normal: [],
      hard: [],
      difference: [],
      personal: [],
      rolling7: [],
      rolling30: [],
      clairvoyant: []
    },
    displayData: []
  });
  const [personalStats, setPersonalStats] = useState<PersonalStats>({ 
    count: 0, 
    total: 0,
    normal: { aboveAverage: 0, belowAverage: 0 },
    hard: { aboveAverage: 0, belowAverage: 0 }
  });

  // Audio States
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioIndex, setAudioIndex] = useState(0);
  const [audioElements] = useState(() => {
    return [
      new Audio('/sounds/chord1.mp3'),
      new Audio('/sounds/chord2.mp3'),
      new Audio('/sounds/chord3.mp3'),
      new Audio('/sounds/chord4.mp3')
    ];
  });

  // Add new state for search
  const [searchWord, setSearchWord] = useState('');
  const [foundWordIndex, setFoundWordIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const cumulativeAverage = useMemo(() => {
    if (!data?.length) return 0;
    const sum = data.reduce((acc, curr) => acc + (isHardMode ? curr.hardAverage : curr.average), 0);
    return sum / data.length;
  }, [data, isHardMode]);

  React.useEffect(() => {
    if (data?.length) {
      // Only set default dates if URL params don't exist
      if (!searchParams.get('from') && !searchParams.get('to')) {
        setSelectedDate(parseISO(data[0].date));
        setSelectedEndDate(parseISO(data[data.length - 1].date));
      }
    }
  }, [data, searchParams]);

  React.useEffect(() => {
    if (data?.length) {
      const processedData = processWordleData(data, personalData);
      
      // Calculate rolling averages before date filtering
      const rolling7Data = calculateRollingAverage(processedData, 7)
        .filter(d => d.rollingAverage !== null);
      const rolling30Data = calculateRollingAverage(processedData, 30)
        .filter(d => d.rollingAverage !== null);

      // Filter data based on date range only
      const filterData = (d: any) => {
        const date = parseISO(d.date);
        const isAfterStart = !selectedDate || date >= startOfDay(selectedDate);
        const isBeforeEnd = !selectedEndDate || date <= endOfDay(selectedEndDate);
        return isAfterStart && isBeforeEnd;
      };

      const filteredData = processedData.filter(filterData);
      const filtered7Data = rolling7Data.filter(filterData);
      const filtered30Data = rolling30Data.filter(filterData);

      // Process cheating analysis data
      const cheatingProcessedData = data.map(d => {
        const normalCheating = cheatingData.normal.find(c => c.date === d.date);
        const hardCheating = cheatingData.hard.find(c => c.date === d.date);
        
        return {
          ...d,
          guessesNumber: normalCheating?.guesses.today ?? null,
          guessesNumberYesterday: normalCheating?.guesses.yesterday ?? null,
          hardGuessesNumber: hardCheating?.guesses.today ?? null,
          hardGuessesNumberYesterday: hardCheating?.guesses.yesterday ?? null,
          proportionDelta: normalCheating?.guesses.proportion.delta ?? null,
          hardProportionDelta: hardCheating?.guesses.proportion.delta ?? null,
          proportion: normalCheating?.guesses.proportion ?? null,
          hardProportion: hardCheating?.guesses.proportion ?? null
        };
      }).filter(filterData);

      setChartState({
        allData: {
          normal: filteredData,
          hard: filteredData,
          difference: filteredData,
          personal: filteredData.filter(d => d.personalDifference !== null),
          rolling7: filtered7Data,
          rolling30: filtered30Data,
          clairvoyant: cheatingProcessedData
        },
        displayData: chartMode === 'clairvoyant' 
          ? cheatingProcessedData
          : chartMode === 'personal' 
            ? filteredData.filter(d => d.personalDifference !== null)
            : chartMode === 'rolling7' 
              ? filtered7Data 
              : chartMode === 'rolling30'
                ? filtered30Data
                : filteredData
      });
    }
  }, [data, personalData, selectedDate, selectedEndDate, cheatingData]);

  React.useEffect(() => {
    if (data?.length && personalData.length) {
      setPersonalStats(calculatePersonalStats(data, personalData));
    }
  }, [data, personalData]);

  React.useEffect(() => {
    if (personalData.length) {
      setFirstGuessData(calculateFirstGuessFrequency(personalData));
    }
  }, [personalData]);

  const handleModeChange = (newMode: typeof chartMode) => {
    setChartMode(newMode);
    setSearchParams(params => {
      params.set('chart', newMode);
      return params;
    });
    if (newMode !== 'firstGuess') {
      setChartState(prev => ({
        ...prev,
        displayData: prev.allData[newMode === 'standard' ? 'normal' : newMode]
      }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (!Array.isArray(json)) {
            throw new Error('Invalid data format: expected an array');
          }
          setPersonalData(json);
          setPersonalStats(calculatePersonalStats(data, json));
        } catch (error) {
          console.error('Error parsing JSON:', error);
          alert('Error parsing file. Please make sure you uploaded a valid JSON file with Wordle data.');
        } finally {
          if (event.target) {
            event.target.value = '';
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(getBookmarkletCode())
      .then(() => {
        setShowInstructions(true);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy script. Please try again.');
      });
  };

  const playNextChord = () => {
    if (soundEnabled) {
      const audio = audioElements[audioIndex];
      audio.volume = 1.0; // Full volume when sound is enabled
      
      // Reset the audio to start
      audio.currentTime = 0;
      
      // Stop any currently playing audio
      audioElements.forEach(a => {
        a.pause();
        a.currentTime = 0;
      });
      
      // Play the new audio
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
      
      // Move to next audio file, loop back to start if at end
      setAudioIndex((prevIndex) => (prevIndex + 1) % audioElements.length);
    }
  };

  const handleTreemapMouseEnter = (data: any) => {
    if (data && data.name) {
      playNextChord();
    }
  };

  // Modify the search effect to only trigger on 5 letters
  useEffect(() => {
    if (searchWord.length === 5 && chartState.displayData.length) {
      const index = chartState.displayData.findIndex(
        d => d.word?.toLowerCase() === searchWord.toLowerCase()
      );
      setFoundWordIndex(index !== -1 ? index : null);
    } else {
      setFoundWordIndex(null);
    }
  }, [searchWord, chartState.displayData]);

  // Modify the effect that calculates point position
  useEffect(() => {
    if (foundWordIndex !== null && chartRef.current) {
      const scatterElements = chartRef.current.getElementsByClassName('recharts-scatter-symbol');
      
      if (scatterElements[foundWordIndex]) {
        const element = scatterElements[foundWordIndex] as SVGElement;
        const bounds = element.getBoundingClientRect();
        const point = {
          x: bounds.left + (bounds.width / 2),
          y: bounds.top + (bounds.height / 2)
        };
        
        onHighlightPoint(point);
      }
    } else {
      onHighlightPoint(null);
    }
  }, [foundWordIndex, onHighlightPoint]);

  const dismissBanner = () => {
    setShowMobileBanner(false);
    localStorage.setItem('hideMobileBanner', 'true');
  };

  if (error) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-lg text-red-600">
        Error loading Wordle data. Please try refreshing the page.
      </div>
    </div>
  );
  if (!data?.length) return null;

  return (
    <div className="h-[100dvh] p-4 flex flex-col overflow-hidden">
      {showMobileBanner && (
        <div className="md:hidden bg-yellow-300 text-black text-center p-2 font-bold relative mb-4">
          This site is best viewed on desktop.
          <button 
            onClick={dismissBanner}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-12 gap-3 mb-4">
        <div className="col-span-12 grid grid-cols-1 sm:grid-cols-[278.517px_1fr] gap-3 items-center">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex-1 inline-flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                {chartMode === 'standard' ? 'Wordle Average' : 
                 chartMode === 'difference' ? 'Normal vs. Hard' : 
                 chartMode === 'personal' ? 'Personal vs. Average' :
                 chartMode === 'rolling7' ? '7-Day Rolling Average' :
                 chartMode === 'rolling30' ? '30-Day Rolling Average' :
                 chartMode === 'clairvoyant' ? 'Clairvoyant Guesses' :
                 'First Guess Frequency'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => handleModeChange('standard')}>
                  Wordle Average
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleModeChange('rolling7')}>
                  7-Day Rolling Average
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleModeChange('rolling30')}>
                  30-Day Rolling Average
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleModeChange('difference')}>
                  Normal vs. Hard
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleModeChange('clairvoyant')}>
                  Clairvoyant Guesses
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Personal Charts</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => handleModeChange('personal')}>
                      Personal vs. Average
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleModeChange('firstGuess')}>
                      First Guess Frequency
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            <a
              href="https://github.com/crtez/is_wordle_harder_or_am_i_just_stupid"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-75 transition-opacity sm:hidden flex-shrink-0"
            >
              <img 
                src="/github-mark.svg" 
                alt="GitHub"
                className="h-6 w-6"
              />
            </a>
          </div>
          
          {chartMode === 'firstGuess' ? (
            <div className="flex items-center gap-3">
              <div className="sm:w-[calc(278.517px_+_88px)]">
                <FileInput
                  onChange={handleFileUpload}
                  fileName={fileName}
                />
              </div>
              <button
                onClick={handleCopyBookmarklet}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 whitespace-nowrap"
              >
                Copy Data Fetcher
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DateRangePicker
                key={`${selectedDate?.toISOString()}-${selectedEndDate?.toISOString()}`}
                align="start"
                initialDateFrom={selectedDate || minDate}
                initialDateTo={selectedEndDate || maxDate}
                onUpdate={({ range }) => {
                  setSelectedDate(range.from);
                  setSelectedEndDate(range.to || range.from);
                  
                  // Update URL params
                  setSearchParams(params => {
                    if (range.from) {
                      params.set('from', range.from.toISOString().split('T')[0]);
                    } else {
                      params.delete('from');
                    }
                    if (range.to) {
                      params.set('to', range.to.toISOString().split('T')[0]);
                    } else {
                      params.delete('to');
                    }
                    return params;
                  });
                }}
                showCompare={false}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSelectedDate(minDate);
                  setSelectedEndDate(maxDate);
                  setSearchParams(params => {
                    params.delete('from');
                    params.delete('to');
                    return params;
                  });
                }}
                title="Reset date range"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <ModeToggle />
            </div>
          )}
        </div>

        {/* Add the desktop version of the GitHub link */}
        <div className="hidden sm:block absolute top-4 right-4">
          <a
            href="https://github.com/crtez/is_wordle_harder_or_am_i_just_stupid"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-75 transition-opacity"
          >
            <img 
              src="/github-mark.svg" 
              alt="GitHub"
              className="h-6 w-6"
            />
          </a>
        </div>

        {chartMode === 'personal' && (
          <div className="col-span-12 flex items-center gap-3">
            <div className="sm:w-[calc(278.517px_+_88px)]">
              <FileInput
                onChange={handleFileUpload}
                fileName={fileName}
              />
            </div>
            <button
              onClick={handleCopyBookmarklet}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 whitespace-nowrap"
            >
              Copy Data Fetcher
            </button>
          </div>
        )}

        <div className="col-span-12 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {(chartMode === 'standard' || chartMode === 'rolling7' || chartMode === 'rolling30' || chartMode === 'clairvoyant') && (
              <div className="flex items-center gap-2">
                <Label htmlFor="hard-mode-toggle">Hard Mode</Label>
                <Switch
                  id="hard-mode-toggle"
                  checked={isHardMode}
                  onCheckedChange={setIsHardMode}
                />
              </div>
            )}
            
            {chartMode !== 'firstGuess' && (
              <div className="flex items-center gap-2">
                <Label htmlFor="show-words">Show Words</Label>
                <Switch
                  id="show-words"
                  checked={showWords}
                  onCheckedChange={setShowWords}
                />
              </div>
            )}

            {chartMode === 'firstGuess' && (
              <div className="flex items-center gap-2">
                <Label htmlFor="sound-toggle">Sound</Label>
                <Switch
                  id="sound-toggle"
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                />
              </div>
            )}

            {chartMode === 'personal' && personalData.length > 0 && (
              <div className="flex items-center gap-2">
                <Label htmlFor="hard-mode-toggle">Hard Mode</Label>
                <Switch
                  id="hard-mode-toggle"
                  checked={isHardMode}
                  onCheckedChange={setIsHardMode}
                />
              </div>
            )}

            {/* Add search input after other controls */}
            {chartMode !== 'firstGuess' && (
              <div className="flex items-center gap-2">
                <Label htmlFor="word-search">Find Word:</Label>
                <Input
                  id="word-search"
                  value={searchWord}
                  onChange={(e) => setSearchWord(e.target.value.toUpperCase())}
                  className="w-24"
                  placeholder="AUDIO"
                  maxLength={5}
                />
              </div>
            )}
          </div>
          
        </div>

        {chartMode === 'personal' && personalStats.count > 0 && (
          <div className="col-span-12">
            <div className="text-sm text-gray-600 dark:text-gray-300 break-normal">
              Comparing <span className="font-bold">{personalStats.count}</span> wordles against {isHardMode ? 'hard' : 'normal'} mode:
              <span className="text-red-600 dark:text-red-400 font-bold"> {isHardMode ? personalStats.hard.aboveAverage : personalStats.normal.aboveAverage}</span> above average,
              <span className="text-green-600 dark:text-green-400 font-bold"> {isHardMode ? personalStats.hard.belowAverage : personalStats.normal.belowAverage}</span> below average
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden" ref={chartRef}>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-500">Loading chart…</div>}>
          <WordleCharts
            chartMode={chartMode}
            displayData={chartState.displayData}
            firstGuessData={firstGuessData}
            personalData={personalData}
            isHardMode={isHardMode}
            showWords={showWords}
            cumulativeAverage={cumulativeAverage}
            foundWordIndex={foundWordIndex}
            selectedDate={selectedDate}
            selectedEndDate={selectedEndDate}
            handleTreemapMouseEnter={handleTreemapMouseEnter}
          />
        </Suspense>
      </div>
      
      <InstructionsDialog 
        open={showInstructions} 
        onOpenChange={setShowInstructions} 
      />
    </div>
  );
};

function App() {
  const [showOneko, setShowOneko] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [highlightedPoint, setHighlightedPoint] = useState<{ x: number, y: number } | null>(null);

  // Add memoized callback to prevent unnecessary re-renders
  const handleHighlightPoint = useCallback((point: { x: number, y: number } | null) => {
    setHighlightedPoint(point);
  }, []);

  useEffect(() => {
    let typedKeys = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      typedKeys += e.key.toLowerCase();
      typedKeys = typedKeys.slice(-3);
      
      if (typedKeys === 'cat') {
        // Update cursor position when activating Oneko
        setCursorPos({ x: window.mouseX || window.innerWidth / 2, y: window.mouseY || window.innerHeight / 2 });
        setShowOneko(prev => !prev);
        typedKeys = '';
      }
    };

    // Track mouse position globally
    const handleMouseMove = (e: MouseEvent) => {
      window.mouseX = e.clientX;
      window.mouseY = e.clientY;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <>
      {showOneko && (
        <Oneko 
          initialPosition={cursorPos} 
          targetPosition={highlightedPoint}
        />
      )}
      <ThemeProvider defaultTheme="system" storageKey="wordle-charts-theme">
        <WordleChart onHighlightPoint={handleHighlightPoint} />
      </ThemeProvider>
    </>
  );
}

export default App;