import { Check, X } from "lucide-react";
import { Card } from "./ds/Card";
import { Button } from "./ds/Button";

interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portion: string;
}

interface FoodSuggestionProps {
  food: FoodItem;
  onAccept: () => void;
  onReject: () => void;
}

export function FoodSuggestion({ food, onAccept, onReject }: FoodSuggestionProps) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-medium">{food.name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {food.portion} • {food.calories} cal
          </p>
          <p className="text-xs text-muted-foreground">
            P: {food.protein}g • C: {food.carbs}g • F: {food.fats}g
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onReject}
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onAccept}
            className="h-8 w-8 text-success hover:bg-success/10"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
