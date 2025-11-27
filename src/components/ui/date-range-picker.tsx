import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format, addMonths, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onDateChange?: (startDate: string, endDate: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onDateChange,
  className,
  placeholder = "Selecionar período",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>();

  // Convert string dates to Date objects for display
  const currentStartDate = startDate ? new Date(startDate) : undefined;
  const currentEndDate = endDate ? new Date(endDate) : undefined;

  // Initialize temp range when opening
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setTempRange({
        from: currentStartDate,
        to: currentEndDate
      });
    }
    setIsOpen(open);
  };

  const handleCancel = () => {
    setTempRange(undefined);
    setIsOpen(false);
  };

  const handleUpdate = () => {
    if (tempRange?.from && tempRange?.to && onDateChange) {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      onDateChange(formatDate(tempRange.from), formatDate(tempRange.to));
    }
    setIsOpen(false);
  };

  const formatDisplayText = () => {
    if (!currentStartDate || !currentEndDate) return placeholder;
    
    if (isSameDay(currentStartDate, currentEndDate)) {
      return format(currentStartDate, "dd/MM/yyyy");
    }
    
    return `${format(currentStartDate, "dd/MM/yyyy")} - ${format(currentEndDate, "dd/MM/yyyy")}`;
  };

  const handlePredefinedRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setTempRange({ from: start, to: end });
  };

  const predefinedRanges = [
    { label: "Últimos 7 dias", days: 7 },
    { label: "Últimos 14 dias", days: 14 },
    { label: "Últimos 30 dias", days: 30 },
    { label: "Últimos 90 dias", days: 90 },
  ];

  const today = new Date();
  const nextMonth = addMonths(today, 1);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal min-w-[280px]",
            !currentStartDate && !currentEndDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background border shadow-lg" align="start">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Selecionar período</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Predefined ranges */}
          <div className="grid grid-cols-2 gap-2">
            {predefinedRanges.map((range) => (
              <Button
                key={range.days}
                variant="outline"
                size="sm"
                onClick={() => handlePredefinedRange(range.days)}
                className="text-xs"
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* Calendar section */}
          <div className="flex gap-4">
            {/* First month */}
            <div>
              <Calendar
                mode="range"
                defaultMonth={currentStartDate || today}
                selected={tempRange}
                onSelect={setTempRange}
                numberOfMonths={1}
                className="pointer-events-auto"
                disabled={(date) => date > new Date()}
              />
            </div>
            
            {/* Second month */}
            <div>
              <Calendar
                mode="range"
                defaultMonth={nextMonth}
                selected={tempRange}
                onSelect={setTempRange}
                numberOfMonths={1}
                className="pointer-events-auto"
                disabled={(date) => date > new Date()}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={!tempRange?.from || !tempRange?.to}
              className="bg-primary hover:bg-primary/90"
            >
              Atualizar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};