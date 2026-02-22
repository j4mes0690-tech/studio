
import { HardHat } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
        <HardHat className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold">Login Disabled</h1>
        <p className="text-muted-foreground mt-2">
            The login functionality has been temporarily disabled for maintenance.
        </p>
    </div>
  );
}
