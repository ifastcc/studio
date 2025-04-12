"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Toaster } from "@/components/ui/toaster";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const PAUSE_DURATIONS = {
  '.': 500,
  '?': 600,
  '!': 550,
  ',': 300,
  ';': 400,
  ':': 350,
  '—': 300,
  '...': 450,
  '\n': 200, // Add pause for new lines
};

// Predefined documents
const PREDEFINED_DOCS = {
  'example.md': '## Example Markdown\n\nThis is an example document with **bold**, *italic*, and `code`.\n\n- List item 1\n- List item 2\n',
  'lorem.txt': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
};

export default function Home() {
  const [text, setText] = useState('');
  const [displayedMarkdown, setDisplayedMarkdown] = useState('');
  const [tokens, setTokens] = useState<string[]>([]);
  const [delayPerToken, setDelayPerToken] = useState(50);
  const [pauseMultiplier, setPauseMultiplier] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [markdownEnabled, setMarkdownEnabled] = useState(true);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [lineHeight, setLineHeight] = useState(1.5);
  const [showSidebar, setShowSidebar] = useState(true);

  const { toast } = useToast();
  const wordRef = useRef<HTMLDivElement>(null);

  const outputSpeed = 1000/delayPerToken;

  // Function to parse text into tokens with Markdown support
  const parseText = useCallback((text: string) => {
    const splitRegex = markdownEnabled
      ? /(\s+|[.?!,;:—…]+|\*\*|\*|`|\n)/g
      : /(\s+|[.?!,;:—…]+|\n)/g;

    // Improved splitting logic to handle Chinese characters
    const chineseRegex = /([\u4e00-\u9fff]+)/g; // Regex to match Chinese characters
    let newTokens: string[] = [];
    text.split(chineseRegex).forEach(part => {
      if (part) {
        if (/[\u4e00-\u9fff]/.test(part)) {
          // If the part contains Chinese characters, split it into individual characters
          newTokens.push(...part.split(''));
        } else {
          // Otherwise, use the existing regex to split the part
          newTokens.push(...part.split(splitRegex).filter(token => token !== ""));
        }
      }
    });

    return newTokens;
  }, [markdownEnabled]);

  useEffect(() => {
    const newTokens = parseText(text);
    setTokens(newTokens);
  }, [text, parseText]);


  const calculateDelay = useCallback((token: string) => {
    let baseDelay = delayPerToken;
    if (Object.keys(PAUSE_DURATIONS).some(p => token.includes(p))) {
      const punctuation = Object.keys(PAUSE_DURATIONS).find(p => token.includes(p)) || '.';
      baseDelay = (PAUSE_DURATIONS as any)[punctuation] * pauseMultiplier;
    }
    return baseDelay;
  }, [delayPerToken, pauseMultiplier]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isPlaying && currentWordIndex < tokens.length) {
      const delay = calculateDelay(tokens[currentWordIndex]);

      timeoutId = setTimeout(() => {
        setDisplayedMarkdown(prevMarkdown => prevMarkdown + tokens[currentWordIndex]);
        setCurrentWordIndex(prevIndex => prevIndex + 1);
      }, delay);
    } else if (isPlaying && currentWordIndex >= tokens.length) {
      setIsPlaying(false);
      toast({
        title: "Finished!",
        description: "You've reached the end of the text.",
      });
    }

    return () => clearTimeout(timeoutId);
  }, [isPlaying, currentWordIndex, tokens, calculateDelay, toast]);

  const togglePlay = () => {
    setIsPlaying(prevIsPlaying => !prevIsPlaying);
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentWordIndex(0);
    setDisplayedMarkdown('');
  };

  // Function to handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setText(content);
      };
      reader.onerror = () => {
        toast({
          title: "Error reading file",
          description: "There was an error reading the file.",
          variant: "destructive",
        });
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        setCurrentWordIndex(Math.max(0, currentWordIndex - 50));
        setDisplayedMarkdown(tokens.slice(0, Math.max(0, currentWordIndex - 50)).join(''));
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault();
        setCurrentWordIndex(Math.min(tokens.length, currentWordIndex + 50));
        setDisplayedMarkdown(tokens.slice(0, Math.min(tokens.length, currentWordIndex + 50)).join(''));
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault();
        setDelayPerToken(prevDelay => Math.max(1, prevDelay - 5)); // Decrease delay, increase speed
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault();
        setDelayPerToken(prevDelay => Math.min(500, prevDelay + 5)); // Increase delay, decrease speed
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, togglePlay, currentWordIndex, tokens, displayedMarkdown, delayPerToken]);

  const handlePredefinedDocLoad = (docName: string) => {
    setText(PREDEFINED_DOCS[docName]);
    reset();
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const renderLineBreaks = (text: string) => {
    return text.split('\n').join('  \n');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Toaster />

      <header className="sticky top-0 bg-secondary p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={toggleSidebar}>
            <Icons.file />
            File
          </Button>
          <Button onClick={togglePlay}>
            {isPlaying ? <Icons.pause /> : <Icons.play />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button onClick={reset}>
            <Icons.reset />
            Reset
          </Button>

          <div>
            Output Speed: {outputSpeed.toFixed(1)} tokens/sec
          </div>
          <div>
            Pause Multiplier: {pauseMultiplier}x
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Icons.settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <div className="flex items-center justify-between">
                Markdown Rendering
                <Switch checked={markdownEnabled} onCheckedChange={setMarkdownEnabled} />
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex flex-col space-y-1">
                Font Size
                <div className="flex space-x-2">
                  <Button size="xs" variant={fontSize === 'sm' ? 'default' : 'outline'} onClick={() => setFontSize('sm')}>Small</Button>
                  <Button size="xs" variant={fontSize === 'md' ? 'default' : 'outline'} onClick={() => setFontSize('md')}>Medium</Button>
                  <Button size="xs" variant={fontSize === 'lg' ? 'default' : 'outline'} onClick={() => setFontSize('lg')}>Large</Button>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex flex-col space-y-1">
                Delay Per Token (ms):
                <Input
                  type="number"
                  value={delayPerToken}
                  onChange={(e) => setDelayPerToken(Number(e.target.value))}
                  className="text-sm"
                />
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-row p-4 space-x-4">
        {showSidebar && (
          <div className="w-1/4">
            <Card>
              <CardContent className="flex flex-col space-y-4">
                <Accordion type="single" collapsible>
                  <AccordionItem value="upload">
                    <AccordionTrigger>Upload File</AccordionTrigger>
                    <AccordionContent>
                      <div className="flex items-center space-x-4">
                        <label htmlFor="upload" className="text-sm font-medium">
                          Select File:
                        </label>
                        <Input
                          type="file"
                          id="upload"
                          onChange={handleFileUpload}
                          className="text-sm"
                          accept=".txt,.md"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="example">
                    <AccordionTrigger>Load Example</AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col space-y-2">
                        {Object.keys(PREDEFINED_DOCS).map(docName => (
                          <Button key={docName} variant="outline" size="sm" onClick={() => handlePredefinedDocLoad(docName)}>
                            {docName}
                          </Button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <Textarea
                  placeholder="Paste your text or upload a file..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mb-4"
                />


                <div className="flex flex-col space-y-2">
                  <label htmlFor="pauseMultiplier" className="text-sm font-medium">
                    Pause Multiplier:
                  </label>
                  <Input
                    type="number"
                    id="pauseMultiplier"
                    value={pauseMultiplier}
                    onChange={(e) => setPauseMultiplier(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>

              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex-grow">
          <Card>
            <CardContent>
              <ScrollArea className="h-[500px] relative overflow-auto whitespace-pre-line">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: React.Fragment,
                    br: () => <br />,
                  }}
                >
                  {renderLineBreaks(displayedMarkdown)}
                </ReactMarkdown>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
