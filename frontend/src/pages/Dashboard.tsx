import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LogOut, Plus } from 'lucide-react';
import { format } from 'date-fns';

type Session = {
  id: string;
  raw_input: string | null;
  status: string;
  started_at: string;
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchSessions();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user?.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user?.id)
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  const handleCreateSession = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .insert([{ user_id: user?.id, status: 'Started' }])
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    } else {
      toast.success('New session created');
      navigate(`/workspace/${data.id}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'In Progress':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
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
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Forensic Sketch AI</h1>
                <p className="text-xs text-muted-foreground">Welcome, {profile?.full_name || 'User'}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleSignOut} size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-6">My Sessions</h2>
            
            {sessions.length === 0 ? (
              <div className="panel p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Create your first forensic sketch session to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <Card
                    key={session.id}
                    className="p-6 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/workspace/${session.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-xs font-mono text-muted-foreground">
                            {session.id.slice(0, 8)}...
                          </p>
                          <Badge className={getStatusColor(session.status)}>
                            {session.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {session.raw_input || 'No description provided yet'}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {format(new Date(session.started_at), 'MMMM d, yyyy')}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-6">Quick Actions</h2>
            <div className="panel p-6">
              <Button onClick={handleCreateSession} className="w-full" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Create New Session
              </Button>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Start a new forensic sketch generation session
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
