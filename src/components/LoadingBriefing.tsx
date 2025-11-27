import React from 'react';

export const LoadingBriefing = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background gap-8">
            <div className="relative w-[65px] aspect-square">
                <span className="absolute rounded-[50px] animate-loaderAnim shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100" />
                <span className="absolute rounded-[50px] animate-loaderAnim animation-delay shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100" />
                <style>{`
          @keyframes loaderAnim {
            0% { inset: 0 35px 35px 0; }
            12.5% { inset: 0 35px 0 0; }
            25% { inset: 35px 35px 0 0; }
            37.5% { inset: 35px 0 0 0; }
            50% { inset: 35px 0 0 35px; }
            62.5% { inset: 0 0 0 35px; }
            75% { inset: 0 0 35px 35px; }
            87.5% { inset: 0 0 35px 0; }
            100% { inset: 0 35px 35px 0; }
          }
          .animate-loaderAnim {
            animation: loaderAnim 2.5s infinite;
          }
          .animation-delay {
            animation-delay: -1.25s;
          }
        `}</style>
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Gerando seu criativo...</h2>
                <p className="text-muted-foreground">Isso pode levar alguns segundos. A inteligência artificial está analisando tendências e criando o melhor conteúdo para você.</p>
            </div>
        </div>
    );
};
