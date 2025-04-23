import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  CalendarDays, 
  FileText, 
  Calculator, 
  ClipboardList,
  FolderKanban
} from "lucide-react";

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="pb-12">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            <Link to="/obras">
              <Button
                variant={location.pathname === "/obras" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Building2 className="mr-2 h-4 w-4" />
                Obras
              </Button>
            </Link>
            <Link to="/diario">
              <Button
                variant={location.pathname === "/diario" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Diário de Obra
              </Button>
            </Link>
            <Link to="/relatorios">
              <Button
                variant={location.pathname === "/relatorios" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <FileText className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
            </Link>
            <Link to="/orcamentos">
              <Button
                variant={location.pathname === "/orcamentos" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Orçamentos
              </Button>
            </Link>
            <Link to="/projetos">
              <Button
                variant={location.pathname === "/projetos" ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                Projetos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 