import { MeshGradient } from "@paper-design/shaders-react"

export default function BackgroundShader() {
  return (
    <div className="fixed inset-0 z-0">
      <MeshGradient
        style={{ height: "100vh", width: "100vw" }}
        distortion={0.8}
        swirl={0.1}
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={1}
        colors={["hsl(266, 100%, 50%)", "hsl(280, 85%, 35%)", "hsl(270, 95%, 60%)", "hsl(260, 90%, 45%)"]}
      />
    </div>
  )
}
