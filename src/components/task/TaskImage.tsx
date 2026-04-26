"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

export function TaskImage({ imageKey, alt }: { imageKey: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false);
  const src = `/task-images/${imageKey}.png`;
  return (
    <>
      <button
        onClick={() => setZoomed(true)}
        className="block w-full overflow-hidden rounded-lg border border-white/10"
      >
        <Image src={src} alt={alt} width={600} height={400} className="w-full" />
      </button>
      <Modal open={zoomed} onClose={() => setZoomed(false)} title={alt}>
        <Image src={src} alt={alt} width={1200} height={800} className="w-full" />
      </Modal>
    </>
  );
}
