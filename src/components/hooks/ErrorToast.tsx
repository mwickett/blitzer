import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/use-toast";

const useErrorToast = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error as string,
        variant: "destructive",
      });
    }
  }, [error]);
};

export default useErrorToast;
