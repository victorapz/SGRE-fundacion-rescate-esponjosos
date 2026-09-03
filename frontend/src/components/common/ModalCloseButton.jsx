import { X } from "lucide-react";
import IconButton from "./IconButton";

export default function ModalCloseButton(props) {
  return (
    <IconButton
      icon={X}
      label="Cerrar"
      title="Cerrar"
      type="button"
      variant="ghost"
      {...props}
    />
  );
}
