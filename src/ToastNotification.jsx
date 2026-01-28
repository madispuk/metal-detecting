import React from "react";
import * as Toast from "@radix-ui/react-toast";
import { cn } from "./lib/utils";

const ToastNotification = ({ toastOpen, setToastOpen, toastMessage }) => {
  return (
    <Toast.Provider swipeDirection="right" duration={2000}>
      <Toast.Root
        className={cn(
          "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 shadow-lg transition-all",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full",
          "bg-gray-800 border-gray-700 text-white"
        )}
        open={toastOpen}
        onOpenChange={setToastOpen}
      >
        <Toast.Description className="text-sm">
          {toastMessage}
        </Toast.Description>
        <Toast.Close className="absolute right-2 top-2 rounded-md p-1 text-gray-400 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none group-hover:opacity-100">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen flex-col p-4 md:max-w-[420px]" />
    </Toast.Provider>
  );
};

export default ToastNotification;
