import { Button } from "@/components/ui/button";
import { ListTodo, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DetalhesObra = () => {
  const navigate = useNavigate();

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/obras/${id}/pendencias`)}
        className="flex items-center gap-2"
      >
        <ListTodo className="h-4 w-4" />
        Pendências
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(`/obras/${id}/demanda`)}
        className="flex items-center gap-2"
      >
        <ShoppingCart className="h-4 w-4" />
        Demanda
      </Button>
    </div>
  );
};

export default DetalhesObra; 