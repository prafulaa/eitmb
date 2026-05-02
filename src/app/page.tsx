"use client";

import { useState, useEffect } from "react";
import { Copy, Sparkles, ArrowRight, CheckCircle2, Lock, LogIn, User, LogOut, Mic, MicOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [tone, setTone] = useState<"Standard" | "Apologetic" | "Optimistic">("Standard");
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // 1. Get User Session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) fetchProfile(user.id);
    });

    // 2. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    // 3. Fallback for guests (localStorage)
    if (!user) {
      const count = parseInt(localStorage.getItem("eitmb_usage") || "0", 10);
      setUsageCount(count);
    }

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("usage_count, is_pro")
      .eq("id", userId)
      .single();
    
    if (data) {
      setUsageCount(data.usage_count);
      setIsPro(data.is_pro);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthMessage("Error: " + error.message);
    } else {
      setAuthMessage("Check your email for the login link!");
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsageCount(parseInt(localStorage.getItem("eitmb_usage") || "0", 10));
    setIsPro(false);
  };

  const handleTranslate = async () => {
    if (!input.trim()) return;

    // Check limits
    if (!isPro && usageCount >= 3) {
      setShowPaywall(true);
      return;
    }

    setIsTranslating(true);
    
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, tone }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setOutput("Error: " + data.error);
        if (data.error.includes("Limit")) setShowPaywall(true);
      } else {
        setOutput(data.result);
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        
        if (!user) {
          localStorage.setItem("eitmb_usage", newCount.toString());
        }
      }
    } catch (err) {
      setOutput("Failed to connect to the server. Please try again.");
    } finally {
      setIsTranslating(false);
      setCopied(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    if (!user) {
      setShowPaywall(true);
      return;
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal error:", err);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Voice Recording. Please use Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (currentTranscript) {
        setInput((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + currentTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      // If still supposed to be recording, restart it (sometimes it auto-stops on silence)
      // Otherwise, keep it off. For simplicity, we'll just stop.
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">EITMB</span>
          {isPro && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Pro</span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 hidden sm:inline">{user.email}</span>
              <button 
                onClick={handleLogout}
                className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowPaywall(true)}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-full transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
          )}
          {isPro ? (
            <button 
              onClick={handleManageSubscription}
              className="bg-slate-100 text-slate-700 text-sm font-bold px-4 py-2 rounded-full hover:bg-slate-200 transition-colors shadow-sm border border-slate-200"
            >
              Manage Subscription
            </button>
          ) : (
            <button 
              onClick={() => setShowPaywall(true)}
              className="bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-slate-800 transition-shadow shadow-sm"
            >
              Upgrade
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Stop Terrifying Your Clients with Tech Jargon.
          </h1>
          <p className="text-lg text-slate-600">
            Instantly translate complex developer updates, bugs, and delays into calm, professional business emails. Save your reputation in one click.
          </p>
        </div>

        {/* Translater UI */}
        <div className="w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col lg:flex-row">
          <div className="flex-1 p-6 lg:p-8 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-slate-200 relative group">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">What the Dev Said</label>
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste what your developer/logs said here, or click the mic to record a meeting..."
              className="flex-1 min-h-[200px] lg:min-h-[300px] w-full resize-none outline-none text-lg text-slate-800 placeholder-slate-400 bg-transparent"
            />
            {isRecording && (
              <div className="absolute bottom-6 left-6 right-6 text-center text-sm font-bold text-red-600 bg-red-50 py-2 rounded-lg border border-red-200 animate-in slide-in-from-bottom-2">
                Recording... Speak now.
              </div>
            )}
          </div>

          <div className="flex-1 p-6 lg:p-8 flex flex-col gap-4 bg-slate-50/50">
            <label className="text-sm font-semibold text-blue-600 uppercase tracking-wider">What to Tell the Boss</label>
            <div className="flex-1 min-h-[200px] lg:min-h-[300px] w-full">
              {output ? (
                <p className="text-lg text-slate-800 whitespace-pre-wrap">{output}</p>
              ) : (
                <p className="text-lg text-slate-400 italic">Your professional translation will appear here...</p>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-4xl mt-8 flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Select Tone</span>
            <div className="flex bg-white p-1 rounded-full border border-slate-200 shadow-sm">
              {(["Standard", "Apologetic", "Optimistic"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tone === t ? "bg-slate-900 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleTranslate}
            disabled={isTranslating || !input.trim()}
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none w-full sm:w-auto min-w-[280px]"
          >
            {isTranslating ? (
              <span className="animate-pulse">Translating...</span>
            ) : (
              <>
                <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Translate to Client-Speak
              </>
            )}
            {!isPro && (
              <span className="absolute -top-3 -right-3 bg-slate-900 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                {Math.max(0, 3 - usageCount)} left
              </span>
            )}
          </button>

          {output && (
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all w-full sm:w-auto min-w-[280px] justify-center border-2 ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm'}`}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-6 h-6" />
                  Copy to Clipboard
                </>
              )}
            </button>
          )}
        </div>
      </main>

      {/* Auth & Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
            >
              ✕
            </button>
            
            {user ? (
              // Payment Section for Logged In Users
              <>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Unlock Unlimited Translations</h2>
                <p className="text-slate-600 mb-8">
                  Get unlimited translations and full tone controls. One simple price.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleUpgrade("price_1TSl9OIwydZQbLP0NgPKJK1u")}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-colors"
                  >
                    Upgrade for $4.99/mo
                  </button>
                  <button 
                    onClick={() => handleUpgrade("price_1TSl9vIwydZQbLP0l5XuVYjs")}
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-4 rounded-xl transition-colors"
                  >
                    Save 20% with Yearly ($49/yr)
                  </button>
                </div>
              </>
            ) : (
              // Login Section for Guests
              <>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <User className="w-8 h-8 text-slate-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Login to Save Progress</h2>
                <p className="text-slate-600 mb-8">
                  Create an account to track your usage and unlock more features.
                </p>
                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  <input 
                    type="email" 
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button 
                    disabled={isLoggingIn}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isLoggingIn ? "Sending..." : "Send Magic Link"}
                  </button>
                  {authMessage && <p className="text-sm font-medium text-blue-600 mt-2">{authMessage}</p>}
                </form>
              </>
            )}
            
            <p className="text-xs text-slate-400 mt-6">Powered by Stripe & Supabase. Cancel anytime.</p>
          </div>
        </div>
      )}
    </div>
  );
}
