import React from "react";
import * as Toast from "@radix-ui/react-toast";
import { cn } from "./lib/utils";

const ToastNotification = ({ toastOpen, setToastOpen, toastMessage }) => {
  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Root
        className={cn(
          "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
          "bg-white border-gray-200"
        )}
        open={toastOpen}
        onOpenChange={setToastOpen}
      >
        <div className="grid gap-1">
          <Toast.Title className="text-sm font-semibold">
            Notification
          </Toast.Title>
          <Toast.Description className="text-sm opacity-90">
            {toastMessage}
          </Toast.Description>
        </div>
        <Toast.Close className="absolute right-2 top-2 rounded-md p-1 text-gray-500 opacity-0 transition-opacity hover:text-gray-900 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100">
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
      <Toast.Viewport className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </Toast.Provider>
  );
};

export default ToastNotification;
