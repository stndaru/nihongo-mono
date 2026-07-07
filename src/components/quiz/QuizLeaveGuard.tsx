import { useBlocker } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Blocks in-app navigation while a quiz session is running and asks for
 * confirmation; also arms the browser's beforeunload prompt for tab
 * closes/reloads. Render it inside the session page with `active` true
 * during the question/feedback phases only.
 */
export function QuizLeaveGuard({ active }: { active: boolean }) {
  const blocker = useBlocker({
    shouldBlockFn: () => active,
    disabled: !active,
    enableBeforeUnload: () => active,
    withResolver: true,
  })

  return (
    <Dialog
      open={blocker.status === 'blocked'}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.()
      }}
    >
      <DialogContent className="max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Leave This Quiz?</DialogTitle>
          <DialogDescription>
            The session isn&apos;t finished — your progress so far will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => blocker.reset?.()}>
            Keep Practicing
          </Button>
          <Button variant="destructive" onClick={() => blocker.proceed?.()}>
            Leave Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
