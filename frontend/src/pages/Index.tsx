import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { InputPanel } from "@/components/InputPanel";
import { CanvasPanel } from "@/components/CanvasPanel";
import { RefinementPanel } from "@/components/RefinementPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Index = () => {
  const { sessionId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [hasSketch, setHasSketch] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // --- NEW STATE: Store the generated eye image from Backend ---
  const [eyeImage, setEyeImage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (sessionId && user) {
      fetchSession();
    }
  }, [sessionId, user]);

  const fetchSession = async () => {
    setLoading(true);
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
      
      // Check if there's a generated face (Existing logic kept)
      const { data: faceData } = await supabase
        .from('composite_faces')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (faceData) {
        setHasSketch(true);
      }
    }
    setLoading(false);
  };

  // --- UPDATED GENERATION LOGIC ---
  const handleGenerate = async (description: string) => {
    toast.loading("Analyzing description & generating attributes...");
    
    // 1. Update session in Supabase (Preserve existing flow)
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ 
        raw_input: description, 
        status: 'Processing' 
      })
      .eq('id', sessionId);

    if (updateError) {
      toast.error('Failed to update session');
      return;
    }

    // 2. Create log entry (Preserve existing flow)
    await supabase
      .from('logs')
      .insert([{
        session_id: sessionId,
        action_type: 'create',
        description: `Input: ${description}`
      }]);

    // 3. CALL REAL BACKEND (Replaces setTimeout simulation)
    try {
      // It MUST be http://127.0.0.1:5000/mistral-chat
      const response = await fetch('http://127.0.0.1:5000/mistral-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: description,
          sessionId: sessionId,
          conversation: [] 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.text || "Backend Error");

      toast.dismiss(); // Clear loading toast

      // 4. Handle Generated Image (Eye Module)
      if (data.generated_image && data.generated_image.category === 'eyes') {
         console.log("✅ Received Eye Image from Backend");
         setEyeImage(data.generated_image.image); // Update State
         setHasSketch(true);
         toast.success("Eye attributes generated successfully!");
      } else {
         toast.info(data.text || "Processed, but no image generated yet.");
      }

      // 5. Update Status to 'In Progress'
      await supabase
        .from('sessions')
        .update({ status: 'In Progress' })
        .eq('id', sessionId);

      // (Optional) Save metadata to composite_faces if you want to track versioning
      // We skip saving the base64 blob to DB for performance, keeping it in State for now.
      await supabase
        .from('composite_faces')
        .insert([{
          session_id: sessionId,
          face_image_path: 'generated_in_memory', 
          version: (session?.version || 0) + 1
        }]);

      fetchSession();

    } catch (error) {
      console.error("Backend API Error:", error);
      toast.error("Could not connect to AI Backend (Check if Flask is running)");
      
      // Reset status on failure
      await supabase
        .from('sessions')
        .update({ status: 'Error' })
        .eq('id', sessionId);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 animate-pulse" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Workspace</h1>
                <p className="text-xs text-muted-foreground">Session: {sessionId?.slice(0, 8)}...</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Status: {session?.status || 'Loading...'}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          <div className="lg:col-span-3">
            <InputPanel 
              onGenerate={handleGenerate} 
              initialValue={session?.raw_input || ''}
            />
          </div>
          
          <div className="lg:col-span-6">
            {/* UPDATED CANVAS PANEL WITH EYE IMAGE PROP */}
            <CanvasPanel 
              caseId={sessionId?.slice(0, 13) || ''}
              realismScore={85}
              hasSketch={hasSketch}
              eyeImage={eyeImage} 
            />
          </div>
          
          <div className="lg:col-span-3">
            <RefinementPanel sessionId={sessionId || ''} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;