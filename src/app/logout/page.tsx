
import { HardHat } from 'lucide-react';

export default function LogoutPage() {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
            <HardHat className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold">Logout Disabled</h1>
            <p className="text-muted-foreground mt-2">
                The logout functionality has been temporarily disabled for maintenance.
            </p>
        </div>
    );
}
