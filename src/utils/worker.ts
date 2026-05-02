import { pipeline, env } from '@xenova/transformers';

// Skip local model check since we are running in the browser
env.allowLocalModels = false;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(progress_callback: Function) {
        if (this.instance === null) {
            this.instance = pipeline(this.task as any, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const transcriber = await PipelineSingleton.getInstance((x: any) => {
        // Send progress back to the main thread
        self.postMessage(x);
    });

    try {
        const output = await transcriber(event.data.audio, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: 'english',
            task: 'transcribe',
        });

        // Send the output back to the main thread
        self.postMessage({ status: 'complete', output });
    } catch (error: any) {
        self.postMessage({ status: 'error', error: error.message });
    }
});
