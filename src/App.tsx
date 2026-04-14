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
  Loader2
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

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
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
    link.download = `icon-${size}x${size}.png`;
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
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-primary/20 pb-24">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header - Matches Screenshot */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6 mb-8"
          >
            <div className="p-4 bg-white rounded-[24px] shadow-xl shadow-black/5 border border-black/5">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">IconCraft AI</h1>
          </motion.div>
          
          {/* Navigation Buttons - With Active State */}
          <div className="flex justify-center gap-12 mb-12">
            <button 
              onClick={() => setActiveMode('upload')} 
              className={`flex items-center gap-2 text-sm font-bold transition-all ${activeMode === 'upload' ? 'text-primary scale-110' : 'text-muted-foreground/60 hover:text-primary'}`}
            >
              <Upload className={`w-5 h-5 ${activeMode === 'upload' ? 'animate-bounce' : ''}`} />
              Upload & Process
            </button>
            <button 
              onClick={() => setActiveMode('generate')} 
              className={`flex items-center gap-2 text-sm font-bold transition-all ${activeMode === 'generate' ? 'text-primary scale-110' : 'text-muted-foreground/60 hover:text-primary'}`}
            >
              <Sparkles className={`w-5 h-5 ${activeMode === 'generate' ? 'animate-pulse' : ''}`} />
              AI Generation
            </button>
          </div>
        </header>

        <main className="space-y-16">
          <AnimatePresence mode="wait">
            {activeMode === 'upload' ? (
              <motion.section 
                key="upload"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-none shadow-2xl shadow-black/5 bg-white overflow-hidden rounded-[24px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-muted-foreground/40">
                      <Upload className="w-5 h-5" />
                      Manual Upload & Process
                    </CardTitle>
                    <CardDescription className="text-muted-foreground/60">
                      Upload your image to automatically remove background and generate icon sizes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-muted-foreground/10 rounded-[20px] p-16 text-center cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all group relative"
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
                          <div className="bg-muted/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                            <Upload className="w-10 h-10 text-muted-foreground/40" />
                          </div>
                          <h3 className="text-2xl font-semibold mb-3 text-muted-foreground/20">Click to upload or drag and drop</h3>
                          <p className="text-muted-foreground/40 font-medium">PNG, JPG or SVG (max. 5MB)</p>
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
                <Card className="border-none shadow-2xl shadow-black/5 bg-white rounded-[24px] overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold text-muted-foreground/40">
                      <Sparkles className="w-5 h-5" />
                      AI Icon Generation
                    </CardTitle>
                    <CardDescription className="text-muted-foreground/60">
                      Describe your ideal icon and we'll generate it in three sizes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0">
                    <div className="relative flex items-center">
                      <Input 
                        id="prompt"
                        placeholder="e.g. A minimalist golden dragon head, dark background, vector style" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="h-20 rounded-[20px] text-lg px-8 pr-44 bg-[#F8F9FA] border-none focus-visible:ring-1 focus-visible:ring-primary/20 shadow-inner"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                      />
                      <Button 
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="absolute right-3 h-14 px-10 rounded-[16px] shadow-lg shadow-primary/20 text-md font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="w-5 h-5 mr-2" />
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
                  <Separator className="flex-1 opacity-50" />
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Generated Icons (PNG)</h2>
                  <Separator className="flex-1 opacity-50" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {SIZES.map((size) => (
                    <Card key={size} className="border-none shadow-xl bg-white group hover:translate-y-[-4px] transition-all duration-300 rounded-[24px]">
                      <CardHeader className="pb-0">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 border-muted-foreground/20">{size} x {size}</Badge>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center p-10">
                        <div className="relative bg-[#F8F9FA] rounded-[20px] p-6 border border-black/[0.03] mb-8 group-hover:shadow-inner transition-all">
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

        <footer className="mt-32 text-center text-sm text-muted-foreground/60">
          <div className="flex justify-center mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAll} 
              className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 rounded-full px-6"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear All & Start Over
            </Button>
          </div>
          <p className="font-medium">© 2026 IconCraft AI. Powered by Gemini.</p>
        </footer>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}
