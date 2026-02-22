import { Header } from '@/components/layout/header';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
import { LogoutForm } from './logout-form';

export default function LogoutPage() {
    return (
        <div className="flex flex-col w-full">
            <Header title="Log Out" />
            <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Are you sure you want to log out?</CardTitle>
                        <CardDescription>You will be returned to the login screen.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LogoutForm />
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
