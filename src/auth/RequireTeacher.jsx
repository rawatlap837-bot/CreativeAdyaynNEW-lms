import AccessGate from "./AccessGate";
export default function RequireTeacher({ children }) {
  return <AccessGate roles={["teacher", "admin"]}>{children}</AccessGate>;
}
