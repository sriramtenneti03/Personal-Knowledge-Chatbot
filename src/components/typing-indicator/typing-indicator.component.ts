import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  template: `
    <div class="flex items-center gap-1.5">
      <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
      <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
      <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypingIndicatorComponent {}
