'use client'

import { Button } from "@/components/ui/button"

type TimeRange = '7d' | '30d' | '90d' | 'custom';

interface TimeRangeFilterProps {
    value: TimeRange;
    onChange: (value: TimeRange) => void;
}

export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
    const ranges: { label: string; value: TimeRange }[] = [
        { label: '7 Days', value: '7d' },
        { label: '30 Days', value: '30d' },
        { label: '90 Days', value: '90d' },
    ];

    return (
        <div className="flex items-center rounded-lg bg-muted p-1">
            {ranges.map((range) => (
                <Button
                    key={range.value}
                    variant={value === range.value ? 'outline' : 'ghost'}
                    size="sm"
                    onClick={() => onChange(range.value)}
                    className={value === range.value ? 'bg-background shadow-sm' : ''}
                >
                    {range.label}
                </Button>
            ))}
             <Button
                variant={value === 'custom' ? 'outline' : 'ghost'}
                size="sm"
                onClick={() => onChange('custom')}
                className={value === 'custom' ? 'bg-background shadow-sm' : ''}
                disabled // Custom date picker not implemented for this prototype
            >
                Custom
            </Button>
        </div>
    )
}
