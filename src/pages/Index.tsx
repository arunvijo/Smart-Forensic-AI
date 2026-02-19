import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InputPanel } from "@/components/InputPanel";
import { CanvasPanel } from "@/components/CanvasPanel";
import { RefinementPanel, RefinementState, ComponentLayer } from "@/components/RefinementPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// --- CONFIGURATION ---
const API_BASE_URL = import.meta.env.DEV 
  ? "http://127.0.0.1:7860" 
  : "https://arunvjo04-smart-forensic-backend.hf.space";

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

const INITIAL_REFINEMENTS: Record<ComponentLayer, RefinementState> = {
  face: { x: 0, y: 0, scale: 1, rotate: 0 },
  hair: { x: 0, y: -40, scale: 1.1, rotate: 0 },
  eyes: { x: 0, y: -50, scale: 1, rotate: 0 },
  nose: { x: 0, y: 15, scale: 1, rotate: 0 },
  mouth: { x: 0, y: 70, scale: 1, rotate: 0 }
};

const Index = () => {
  const { sessionId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // --- STATE PERSISTENCE KEYS ---
  const IMAGES_STORAGE_KEY = sessionId ? `forensic-images-${sessionId}` : "";
  const STEP_STORAGE_KEY = sessionId ? `forensic-step-${sessionId}` : "";

  // --- SESSION & UI STATE ---
  const [step, setStep] = useState<"select_face" | "chat">(() => {
    if (typeof window !== "undefined" && STEP_STORAGE_KEY) {
      return (window.localStorage.getItem(STEP_STORAGE_KEY) as any) || "select_face";
    }
    return "select_face";
  });
  
  const [hasSketch, setHasSketch] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);

  // --- COMPONENT LAYERS (With Persistence Loader) ---
  const loadStoredImages = () => {
    if (typeof window === "undefined" || !IMAGES_STORAGE_KEY) return null;
    const stored = window.localStorage.getItem(IMAGES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  };

  const initialImages = loadStoredImages();

  // Face Shapes & Global Context
  const [faceShape, setFaceShape] = useState<string>(initialImages?.faceShape || "oval");
  const [gender, setGender] = useState<string>(initialImages?.gender || "male");
  const [ageGroup, setAgeGroup] = useState<string>(initialImages?.ageGroup || "young");

  // Images
  const [eyeImage, setEyeImage] = useState<string | null>(initialImages?.eyeImage || null);
  const [mouthImage, setMouthImage] = useState<string | null>(initialImages?.mouthImage || null);
  const [noseImage, setNoseImage] = useState<string | null>(initialImages?.noseImage || null);
  const [hairImage, setHairImage] = useState<string | null>(initialImages?.hairImage || null); 

  const [activeLayer, setActiveLayer] = useState<ComponentLayer>("eyes");
  const [allRefinements, setAllRefinements] = useState<Record<ComponentLayer, RefinementState>>(
    initialImages?.refinements || INITIAL_REFINEMENTS
  );

  const hasFetched = useRef(false);
  
  // Track if this is the first message so we can silently inject Age & Gender
  const isFirstPrompt = useRef(true);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    if (typeof window !== "undefined" && IMAGES_STORAGE_KEY) {
      const stateToSave = {
        faceShape,
        gender,
        ageGroup,
        eyeImage,
        mouthImage,
        noseImage,
        hairImage,
        refinements: allRefinements
      };
      window.localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [faceShape, gender, ageGroup, eyeImage, mouthImage, noseImage, hairImage, allRefinements, IMAGES_STORAGE_KEY]);

  useEffect(() => {
    if (typeof window !== "undefined" && STEP_STORAGE_KEY) {
      window.localStorage.setItem(STEP_STORAGE_KEY, step);
    }
  }, [step, STEP_STORAGE_KEY]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (sessionId && user?.id) {
      const stored = loadStoredImages();
      if (!stored && !hasFetched.current) {
        setHasSketch(false);
        setStep("select_face");
        setFaceShape("oval");
        setGender("male");
        setAgeGroup("young");
        setEyeImage(null);
        setNoseImage(null);
        setMouthImage(null);
        setHairImage(null);
        setMessages([]);
        setAllRefinements(INITIAL_REFINEMENTS);
        isFirstPrompt.current = true; // Reset prompt tracker on new session
      } else if (stored) {
        setHasSketch(true);
        isFirstPrompt.current = false; // Already have sketch, not the first prompt
      }
      
      if (!hasFetched.current) {
        fetchSession();
        hasFetched.current = true;
      }
    }
    return () => { hasFetched.current = false; };
  }, [sessionId, user?.id]);

  const fetchSession = async () => {
    if (!session) setLoading(true);
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      toast.error('Failed to load session');
      navigate('/dashboard');
    } else {
      setSession(data);
      
      const { data: faceData } = await supabase
        .from('composite_faces')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (faceData) {
        setHasSketch(true);
        setStep("chat"); 
      }
    }
    setLoading(false);
  };

  const handleRefinementChange = (newState: RefinementState) => {
    setAllRefinements(prev => ({ ...prev, [activeLayer]: newState }));
  };

  const handleGenerate = async (description: string) => {
    const newMessages: Message[] = [...messages, { sender: 'user', text: description }];
    setMessages(newMessages);

    const loadingToast = toast.loading("AI is sketching features...");
    
    // --- SILENT CONTEXT INJECTION ---
    // Prepend the UI selections so the backend LLM gets the Age and Gender immediately
    let backendPrompt = description;
    if (isFirstPrompt.current) {
      backendPrompt = `Suspect is a ${ageGroup} ${gender}. ` + description;
      isFirstPrompt.current = false;
    }

    await supabase
      .from('sessions')
      .update({ raw_input: backendPrompt, status: 'Processing' })
      .eq('id', sessionId);

    try {
      const response = await fetch(`${API_BASE_URL}/mistral-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: backendPrompt, // Send the injected prompt to the AI
          sessionId: sessionId,
          conversation: newMessages
        }),
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.text || "Backend Connection Failed");

      toast.dismiss(loadingToast);

      if (data.text) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.text }]);
      }

      if (data.attributes?.face?.shape) {
        setFaceShape(data.attributes.face.shape);
      } else {
        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes("round")) setFaceShape("round");
        else if (lowerDesc.includes("square")) setFaceShape("square");
        else if (lowerDesc.includes("oval")) setFaceShape("oval");
      }

      if (data.generated_images && data.generated_images.length > 0) {
        data.generated_images.forEach((imgObj: { category: string, image: string }) => {
          const formattedImage = `data:image/png;base64,${imgObj.image}`;
          if (imgObj.category === 'eyes') setEyeImage(formattedImage);
          else if (imgObj.category === 'mouth') setMouthImage(formattedImage);
          else if (imgObj.category === 'nose') setNoseImage(formattedImage);
          else if (imgObj.category === 'hair') setHairImage(formattedImage); 
        });

        setHasSketch(true);
        toast.success("Sketch updated!");
      } else {
        toast.info(data.text || "Attributes updated. Continue describing.");
      }

      await supabase
        .from('sessions')
        .update({ status: 'In Progress' })
        .eq('id', sessionId);

      return data.text; 

    } catch (error) {
      console.error("Backend Error:", error);
      toast.dismiss(loadingToast);
      toast.error("Could not connect to AI Backend");
      
      await supabase
        .from('sessions')
        .update({ status: 'Error' })
        .eq('id', sessionId);
    }
  };

  if (authLoading || (loading && !session)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 animate-pulse" />
          <p className="text-muted-foreground">Loading forensic workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm shrink-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Forensic Workspace</h1>
                <p className="text-xs text-muted-foreground">Session: {sessionId?.slice(0, 8)}...</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
              Status: {session?.status || 'Active'}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-6 overflow-hidden">
        {step === "select_face" ? (
          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto mt-4 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Step 1: Global Information</h2>
              <p className="text-muted-foreground text-lg">Select the basic structural traits before refining specific features.</p>
            </div>
            
            {/* FACE SHAPE SELECTION */}
            <div className="flex gap-6 justify-center w-full">
              {["oval", "round", "square"].map((shape) => (
                <div 
                  key={shape}
                  onClick={() => setFaceShape(shape)}
                  className={`cursor-pointer border-4 rounded-2xl p-4 transition-all w-44 flex flex-col items-center gap-3 bg-card shadow-sm hover:shadow-md ${
                    faceShape === shape ? "border-primary bg-primary/5 scale-105" : "border-transparent hover:border-primary/30"
                  }`}
                >
                  <img src={`/faces/${shape}_face.png`} alt={shape} className="w-28 h-28 object-contain opacity-70" />
                  <p className="text-center font-semibold capitalize text-base">{shape}</p>
                </div>
              ))}
            </div>

            {/* AGE AND GENDER SELECTION */}
            <div className="grid grid-cols-2 gap-10 w-full max-w-xl mt-4">
              {/* Gender */}
              <div className="space-y-3 bg-secondary/30 p-5 rounded-2xl border">
                <h3 className="text-center font-medium text-muted-foreground">Biological Gender</h3>
                <div className="flex gap-3 justify-center">
                  {["male", "female"].map(g => (
                    <Button 
                      key={g} 
                      variant={gender === g ? "default" : "outline"} 
                      onClick={() => setGender(g)} 
                      className="capitalize w-full"
                    >
                      {g}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Age */}
              <div className="space-y-3 bg-secondary/30 p-5 rounded-2xl border">
                <h3 className="text-center font-medium text-muted-foreground">Estimated Age</h3>
                <div className="grid grid-cols-3 gap-2 justify-center">
                  {["young", "middle-aged", "old"].map(a => (
                    <Button 
                      key={a} 
                      variant={ageGroup === a ? "default" : "outline"} 
                      onClick={() => setAgeGroup(a)} 
                      className="capitalize text-xs px-2"
                    >
                      {a === "middle-aged" ? "Middle" : a}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Button 
              size="lg"
              onClick={() => setStep("chat")}
              className="mt-6 px-12 py-6 text-lg rounded-xl shadow-lg hover:scale-105 transition-transform"
            >
              Confirm Setup & Begin Sketch
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div className="lg:col-span-3 h-full overflow-hidden flex flex-col">
              <InputPanel onGenerate={handleGenerate} initialValue={session?.raw_input || ''} />
            </div>
            
            <div className="lg:col-span-6 h-full overflow-hidden flex flex-col">
              <CanvasPanel 
                caseId={sessionId?.slice(0, 13) || ''}
                realismScore={85}
                hasSketch={hasSketch}
                faceShape={faceShape}
                eyeImage={eyeImage} 
                mouthImage={mouthImage}
                noseImage={noseImage}
                hairImage={hairImage} 
                allRefinements={allRefinements}
              />
            </div>
            
            <div className="lg:col-span-3 h-full overflow-hidden flex flex-col">
              <RefinementPanel 
                selectedLayer={activeLayer}
                onLayerChange={setActiveLayer}
                refinement={allRefinements[activeLayer]} 
                onRefinementChange={handleRefinementChange} 
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;