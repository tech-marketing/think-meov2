"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type FloatingActionMenuProps = {
  options: {
    label: string;
    onClick: () => void;
    Icon?: React.ReactNode;
  }[];
  className?: string;
  triggerButton?: React.ReactNode;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
};

const FloatingActionMenu = ({
  options,
  className,
  triggerButton,
  isOpen: controlledIsOpen,
  onToggle,
}: FloatingActionMenuProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const toggleMenu = () => {
    const newState = !isOpen;
    if (onToggle) {
      onToggle(newState);
    } else {
      setInternalIsOpen(newState);
    }
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {triggerButton ? (
        <div onClick={toggleMenu}>{triggerButton}</div>
      ) : (
        <Button
          onClick={toggleMenu}
          className="w-10 h-10 rounded-full bg-[#11111198] hover:bg-[#111111d1] shadow-[0_0_20px_rgba(0,0,0,0.2)]"
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
          >
            <Plus className="w-6 h-6" />
          </motion.div>
        </Button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(10px)" }}
            transition={{
              duration: 0.6,
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
            className="absolute bottom-full left-0 mb-2 z-[60]"
          >
            <div className="flex flex-col items-start gap-2 min-w-[200px]">
              {options.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                  }}
                  className="w-full"
                >
                  <Button
                    onClick={() => {
                      option.onClick();
                      toggleMenu();
                    }}
                    size="sm"
                    className="flex items-center gap-2 w-full justify-start bg-card/95 hover:bg-card border border-border shadow-lg backdrop-blur-sm text-purple-500 [&_svg]:text-purple-500"
                  >
                    {option.Icon}
                    <span>{option.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingActionMenu;
