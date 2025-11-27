/**
 * EmailJS Integration for Interview Results
 * Sends interview details and video URL via email
 */

import emailjs from '@emailjs/browser';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_pdmyric';
const EMAILJS_PUBLIC_KEY = '5sgdBsPJnFGBkoFEB';
const EMAILJS_TEMPLATE_ID = 'template_interview'; // You'll need to create this template

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

export interface EmailData {
    candidateName: string;
    email: string;
    role: string;
    language: string;
    status: string;
    notes: string;
    transcript: string;
    videoUrl: string;
    date: string;
}

/**
 * Send interview results via EmailJS
 */
export async function sendInterviewEmail(data: EmailData): Promise<{ success: boolean; error?: string }> {
    console.log('📧 [EMAIL] Sending interview results...');
    console.log('📧 [EMAIL] Recipient: cehpoint@gmail.com, hr@cehpoint.co.in');

    try {
        const templateParams = {
            to_email: 'cehpoint@gmail.com, hr@cehpoint.co.in',
            candidate_name: data.candidateName,
            candidate_email: data.email,
            role: data.role,
            language: data.language,
            status: data.status,
            notes: data.notes,
            transcript: data.transcript,
            video_url: data.videoUrl || 'No video recorded',
            date: data.date,
            reply_to: 'hr@cehpoint.co.in',
        };

        console.log('📧 [EMAIL] Template params:', { ...templateParams, transcript: '[truncated]' });

        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
        );

        console.log('✅ [EMAIL] Email sent successfully!', response);

        return {
            success: true,
        };
    } catch (error: any) {
        console.error('❌ [EMAIL] Failed to send email:', error);
        return {
            success: false,
            error: error.text || error.message || 'Failed to send email',
        };
    }
}
