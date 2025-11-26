import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ErrorState({
  title = "Error",
  message,
  onRetry,
  fullScreen = false,
}: ErrorStateProps) {
  const containerClass = fullScreen
    ? "flex items-center justify-center min-h-screen"
    : "flex items-center justify-center py-8";

  return (
    <div className={containerClass}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-destructive mb-2">{title}</h3>
        <p className="text-destructive mb-4">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
