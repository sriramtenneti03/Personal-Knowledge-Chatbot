import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { ChatMessage, IngestResponse, ChatResponse } from './models/chat.model';
import { TypingIndicatorComponent } from './components/typing-indicator/typing-indicator.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypingIndicatorComponent, CommonModule],
})
export class AppComponent {
  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileUpload') private fileUpload!: ElementRef<HTMLInputElement>;

  private http = inject(HttpClient);

  // Ingestion State
  selectedFile: WritableSignal<File | null> = signal(null);
  isIngesting: WritableSignal<boolean> = signal(false);
  ingestionStatus: WritableSignal<string> = signal('Upload documents to begin.');
  ingestionStatusType: WritableSignal<'info'|'success'|'error'> = signal('info');
  docsIngested: WritableSignal<boolean> = signal(false);

  // Chat State
  chatHistory: WritableSignal<ChatMessage[]> = signal([]);
  isBotTyping: WritableSignal<boolean> = signal(false);
  
  ingestionStatusClass = computed(() => {
    switch(this.ingestionStatusType()) {
        case 'success': return 'text-green-400';
        case 'error': return 'text-red-400';
        default: return 'text-slate-400';
    }
  });
  
  private readonly ALLOWED_FILE_TYPES = [
    'application/zip', 
    'application/pdf', 
    'text/markdown', 
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
  ];


  constructor() {
    effect(() => {
      if (this.chatHistory()) {
        this.scrollToBottom();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (this.ALLOWED_FILE_TYPES.includes(file.type)) {
        this.selectedFile.set(file);
        this.ingestionStatus.set(`Selected: ${file.name}`);
        this.ingestionStatusType.set('info');
      } else {
        this.selectedFile.set(null);
        this.ingestionStatus.set(`File type not supported. Please select a valid document.`);
        this.ingestionStatusType.set('error');
      }
    }
  }

  uploadAndIngest(): void {
    const file = this.selectedFile();
    if (!file) {
      this.ingestionStatus.set('No file selected.');
      this.ingestionStatusType.set('error');
      return;
    }

    this.isIngesting.set(true);
    this.ingestionStatus.set(`Processing ${file.name}...`);
    this.ingestionStatusType.set('info');

    const formData = new FormData();
    const isZip = file.type === 'application/zip';
    const url = isZip ? '/ingest-folder' : '/ingest-file';
    const formKey = isZip ? 'folder' : 'file';
    formData.append(formKey, file);

    this.http.post<IngestResponse>(url, formData)
      .pipe(finalize(() => this.isIngesting.set(false)))
      .subscribe({
        next: (response) => {
          if (response.status === 'ingested') {
            this.ingestionStatus.set(`Successfully added ${response.num_chunks} new chunks from ${file.name}.`);
            this.ingestionStatusType.set('success');
            this.docsIngested.set(true);
            if(this.chatHistory().length === 0) {
              this.chatHistory.set([{ role: 'bot', content: 'Knowledge base updated. You can now ask me questions about your documents.' }]);
            }
          } else {
            this.ingestionStatus.set(response.error || `Failed to process ${file.name}.`);
            this.ingestionStatusType.set('error');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.ingestionStatus.set(`Error: ${err.statusText} - Is the backend server running?`);
          this.ingestionStatusType.set('error');
          console.error(err);
        }
      });
  }

  clearKnowledgeBase(): void {
    if (!confirm('Are you sure you want to clear the entire knowledge base? This action cannot be undone.')) {
        return;
    }
    this.http.post<{status: string}>('/clear-knowledge-base', {})
      .subscribe({
        next: () => {
            this.ingestionStatus.set('Knowledge base cleared. Upload new documents to begin.');
            this.ingestionStatusType.set('info');
            this.docsIngested.set(false);
            this.chatHistory.set([]);
            this.selectedFile.set(null);
            if(this.fileUpload.nativeElement) {
              this.fileUpload.nativeElement.value = '';
            }
        },
        error: (err: HttpErrorResponse) => {
            this.ingestionStatus.set(`Error clearing knowledge base: ${err.statusText}`);
            this.ingestionStatusType.set('error');
        }
      });
  }

  sendMessage(inputElement: HTMLInputElement): void {
    const question = inputElement.value.trim();
    if (!question || this.isBotTyping()) return;

    inputElement.value = '';
    this.chatHistory.update(history => [...history, { role: 'user', content: question }]);
    this.isBotTyping.set(true);

    this.http.post<ChatResponse>('/chat', { question })
      .pipe(finalize(() => this.isBotTyping.set(false)))
      .subscribe({
        next: (response) => {
          if (response.answer) {
            this.chatHistory.update(history => [...history, { role: 'bot', content: response.answer, citations: response.citations }]);
          } else {
            this.chatHistory.update(history => [...history, { role: 'error', content: response.error || 'Failed to get a response.' }]);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.chatHistory.update(history => [...history, { role: 'error', content: `Error: ${err.statusText}. Could not connect to the chat backend.` }]);
          console.error(err);
        }
      });
  }

  private scrollToBottom(): void {
    try {
      setTimeout(() => {
         if (this.chatContainer?.nativeElement) {
            this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
         }
      }, 0);
    } catch (err) {
      console.error('Could not scroll to bottom:', err);
    }
  }
}