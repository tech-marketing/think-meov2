import React, { Component, ReactNode } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SafeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('SafeErrorBoundary caught an error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SafeErrorBoundary details:', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <Card className="border-destructive">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <h3 className="text-lg font-semibold mb-2">Ops! Algo deu errado</h3>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message || 'Erro inesperado'}
            </p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Tentar novamente
            </button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}