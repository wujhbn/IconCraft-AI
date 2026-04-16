/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Download, 
  Sparkles, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { trimImage, resizeToIcon, removeBackground } from '@/lib/image-utils';

const SIZES = [192, 512, 1024];

export default function App() {
  const [activeMode, setActiveMode] = useState<'upload' | 'generate'>('upload');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processedIcons, setProcessedIcons] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [tolerance, setTolerance] = useState(20);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasSelectedKey, setHasSelectedKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore - aistudio is injected by the environment
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasSelectedKey(selected);
      } else {
        // If not running in AI Studio, assume true to not block development
        setHasSelectedKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio?.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasSelectedKey(true); // Assume success right away to avoid race condition
      }
    } catch (error) {
      console.error("Error opening key selector:", error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImage(dataUrl);
      processImage(dataUrl, tolerance);
    };
    reader.readAsDataURL(file);
  };

  const processImage = (dataUrl: string, currentTolerance: number) => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const bgRemoved = removeBackground(canvas, currentTolerance);
      const trimmed = trimImage(bgRemoved, currentTolerance);
      
      if (trimmed) {
        const icons: Record<number, string> = {};
        SIZES.forEach(size => {
          icons[size] = resizeToIcon(trimmed, size);
        });
        setProcessedIcons(icons);
        toast.success("Image processed successfully!");
      } else {
        toast.error("Could not process image. It might be empty or fully white.");
      }
      setIsProcessing(false);
    };
    img.src = dataUrl;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a description for the icon.");
      return;
    }

    if (!hasSelectedKey) {
      toast.error("請先在右上角設定 API Key 以啟用高畫質 AI 生成功能。");
      handleSelectKey();
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              text: `Generate a high-quality, professional, modern app icon for: ${prompt}. The icon should be centered, have a clean background (preferably white or transparent), and be suitable for mobile or web applications. Minimalist style.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          },
        },
      });

      let base64Data = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          break;
        }
      }

      if (base64Data) {
        const imageUrl = `data:image/png;base64,${base64Data}`;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const bgRemoved = removeBackground(canvas, 10);
            const trimmed = trimImage(bgRemoved, 10); 
            const finalSource = trimmed || bgRemoved || canvas;
            const icons: Record<number, string> = {};
            SIZES.forEach(size => {
              icons[size] = resizeToIcon(finalSource, size);
            });
            setProcessedIcons(icons);
            toast.success("Icon generated successfully!");
          }
        };
        img.src = imageUrl;
      } else {
        throw new Error("No image data received from AI.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate icon. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadIcon = (size: number) => {
    const dataUrl = processedIcons[size];
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `icon-${size}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    setUploadedImage(null);
    setProcessedIcons({});
    setPrompt('');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-primary/20 pb-24 relative overflow-x-hidden">
      {/* Top API Key Status - Made accessible on mobile */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex items-center gap-2">
        {!hasSelectedKey ? (
          <Button variant="outline" size="sm" onClick={handleSelectKey} className="gap-1 sm:gap-2 bg-white/80 backdrop-blur-md border-primary/20 text-primary hover:bg-primary/5 rounded-full px-3 sm:px-4 shadow-sm text-xs sm:text-sm">
            <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">設定 API Key</span>
            <span className="inline xs:hidden">設定 Key</span>
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={handleSelectKey} className="gap-1 sm:gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 rounded-full px-3 sm:px-4 shadow-sm transition-colors text-xs sm:text-sm">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
              <span className="hidden xs:inline">API Key 已連結</span>
              <span className="inline xs:hidden">已連結</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHasSelectedKey(false)} className="gap-1 bg-white/80 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-gray-500 border-gray-200 rounded-full px-2 sm:px-3 shadow-sm transition-colors" title="清除">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 mt-12 sm:mt-0">
        {/* Header */}
        <header className="mb-8 sm:mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 sm:gap-6 mb-6 sm:mb-8"
          >
            <div className="p-3 sm:p-4 bg-white rounded-[20px] sm:rounded-[24px] shadow-xl shadow-black/5 border border-black/5 relative">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1A1A1A]">IconCraft AI</h1>
          </motion.div>
          
          {/* Navigation Buttons */}
          <div className="flex flex-row justify-center items-center gap-4 sm:gap-12 mb-8 sm:mb-12">
            <button 
              onClick={() => setActiveMode('upload')} 
              className={`flex items-center gap-2 text-xs sm:text-sm font-bold transition-all p-3 sm:p-0 rounded-xl sm:rounded-none w-1/2 sm:w-auto justify-center ${activeMode === 'upload' ? 'bg-primary/5 sm:bg-transparent text-primary sm:scale-110' : 'text-gray-500 hover:text-primary'}`}
            >
              <Upload className={`w-4 h-4 sm:w-5 sm:h-5 ${activeMode === 'upload' ? 'animate-bounce' : ''}`} />
              Upload & Process
            </button>
            <button 
              onClick={() => setActiveMode('generate')} 
              className={`flex items-center gap-2 text-xs sm:text-sm font-bold transition-all p-3 sm:p-0 rounded-xl sm:rounded-none w-1/2 sm:w-auto justify-center ${activeMode === 'generate' ? 'bg-primary/5 sm:bg-transparent text-primary sm:scale-110' : 'text-gray-500 hover:text-primary'}`}
            >
              <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${activeMode === 'generate' ? 'animate-pulse' : ''}`} />
              AI Generation
            </button>
          </div>
        </header>

        <main className="space-y-8 sm:space-y-16">
          <AnimatePresence mode="wait">
            {activeMode === 'upload' ? (
              <motion.section 
                key="upload"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-none shadow-2xl shadow-black/5 bg-white overflow-hidden rounded-[20px] sm:rounded-[24px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-800">
                      <Upload className="w-5 h-5 text-primary" />
                      Manual Upload & Process
                    </CardTitle>
                    <CardDescription className="text-gray-500 text-xs sm:text-sm">
                      Upload your image to automatically remove background and generate icon sizes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-8">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-[16px] sm:rounded-[20px] p-8 sm:p-16 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all group relative min-h-[200px] flex flex-col justify-center"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      
                      {uploadedImage ? (
                        <div className="flex flex-col items-center">
                          <div className="relative mb-6">
                            <img 
                              src={uploadedImage} 
                              alt="Original" 
                              className="max-h-32 object-contain rounded-xl shadow-lg"
                            />
                            <div className="absolute -top-2 -right-2 bg-primary text-white p-1 rounded-full shadow-lg">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          </div>
                          <p className="text-sm font-medium text-primary">Image uploaded. Click to change.</p>
                        </div>
                      ) : (
                        <>
                          <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                            <Upload className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-2xl font-bold mb-3 text-gray-800">Click to upload or drag and drop</h3>
                          <p className="text-gray-500 font-medium">PNG, JPG or SVG (max. 5MB)</p>
                        </>
                      )}
                    </div>

                    {uploadedImage && (
                      <div className="mt-8 space-y-4 max-w-md mx-auto">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold text-muted-foreground">Background Removal Tolerance</Label>
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{tolerance}</Badge>
                        </div>
                        <Slider 
                          value={[tolerance]} 
                          onValueChange={(v) => {
                            setTolerance(v[0]);
                            if (uploadedImage) processImage(uploadedImage, v[0]);
                          }} 
                          max={100} 
                          step={1}
                          className="py-4"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.section>
            ) : (
              <motion.section 
                key="generate"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="pt-8"
              >
                <Card className="border-none shadow-2xl shadow-black/5 bg-white rounded-[20px] sm:rounded-[24px] overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-800">
                      <Sparkles className="w-5 h-5 text-primary" />
                      AI Icon Generation
                    </CardTitle>
                    <CardDescription className="text-gray-500 text-xs sm:text-sm">
                      Describe your ideal icon and we'll generate it in three sizes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-8 pt-0">
                    <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0">
                      <Input 
                        id="prompt"
                        placeholder="e.g. A minimalist golden dragon head..." 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="h-14 sm:h-20 rounded-[16px] sm:rounded-[20px] text-base sm:text-lg px-4 sm:px-8 sm:pr-44 bg-gray-50 border-gray-200 focus-visible:ring-2 focus-visible:ring-primary shadow-inner text-gray-800 placeholder:text-gray-400"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                      />
                      <Button 
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="sm:absolute sm:right-3 h-[52px] sm:h-14 px-6 sm:px-10 rounded-[14px] sm:rounded-[16px] shadow-lg shadow-primary/20 text-sm sm:text-md font-bold transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        )}
                        Generate
                      </Button>
                    </div>

                    {isGenerating && (
                      <div className="flex flex-col items-center justify-center py-16 space-y-6">
                        <div className="relative">
                          <div className="w-24 h-24 border-4 border-primary/5 border-t-primary rounded-full animate-spin" />
                          <Sparkles className="w-10 h-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-muted-foreground font-semibold text-lg animate-pulse">AI is crafting your icons...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Results Section - Shows below the active tool if icons exist */}
          <AnimatePresence>
            {Object.keys(processedIcons).length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-10"
              >
                <div className="flex items-center gap-6">
                  <Separator className="flex-1 opacity-50 border-gray-300" />
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-600">Generated Icons (PNG)</h2>
                  <Separator className="flex-1 opacity-50 border-gray-300" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {SIZES.map((size) => (
                    <Card key={size} className="border border-gray-100 shadow-xl bg-white group hover:translate-y-[-4px] transition-all duration-300 rounded-[20px] sm:rounded-[24px]">
                      <CardHeader className="pb-0 pt-4 sm:pt-6">
                        <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 mb-2">
                          <span className="text-xs sm:text-sm font-bold text-gray-700">Specification: {size}x{size}px</span>
                          <Badge variant="outline" className="font-mono text-[10px] sm:text-xs px-2 sm:px-3 py-1 border-gray-200 bg-gray-50 text-gray-600">icon-{size}.png</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center p-4 sm:p-8 pt-2 sm:pt-4">
                        <div className="relative bg-gray-50 rounded-[16px] sm:rounded-[20px] p-4 sm:p-6 border border-gray-100 mb-6 sm:mb-8 group-hover:shadow-inner transition-all w-full flex justify-center">
                          <img 
                            src={processedIcons[size]} 
                            alt={`${size}px icon`} 
                            style={{ width: Math.min(size, 140), height: Math.min(size, 140) }}
                            className="object-contain drop-shadow-2xl"
                          />
                        </div>
                        <Button 
                          variant="secondary" 
                          className="w-full h-12 rounded-xl bg-[#F1F3F5] hover:bg-primary hover:text-white transition-all font-semibold"
                          onClick={() => downloadIcon(size)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PNG
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-32 text-center text-sm text-gray-500 pb-12">
          <div className="flex justify-center mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAll} 
              className="text-gray-500 hover:text-destructive hover:bg-destructive/10 rounded-full px-6 font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear All & Start Over
            </Button>
          </div>
          <p className="font-medium text-gray-400">© 2026 IconCraft AI. Powered by Gemini.</p>
        </footer>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
