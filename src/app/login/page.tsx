import { LoginForm } from './login-form';
import Image from 'next/image';
import { Logo } from '@/components/logo';

export function LoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center">
            {/* Animated Logo Section: Animates in once and stays static */}
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse scale-150" />
              <div className="relative z-10 animate-in fade-in zoom-in slide-in-from-top-4 duration-1000 ease-out">
                <Logo 
                  hideText 
                  iconClassName="h-12 w-12 md:h-16 md:w-16" 
                />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight text-primary">SiteCommand</h1>
          </div>
          <LoginForm />
        </div>
      </div>
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDB8fHx8MTczOTA4NjQyNXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Construction Site"
          fill
          className="object-cover"
          priority
          data-ai-hint="construction site"
        />
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px]" />
      </div>
    </div>
  );
}

export default LoginPage;
