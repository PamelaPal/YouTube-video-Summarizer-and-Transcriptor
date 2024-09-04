let videoId = "";
let summaryCount = 0;
const FREE_LIMIT = 3;
const MAX_SUB_LIMIT = 2;




document.addEventListener('DOMContentLoaded', function () {
    const showTranscriptBtn = document.querySelector('#transcript .btn-popup');
    const showSummaryBtn = document.querySelector('#summary .btn-popup');
    const popupContainer = document.querySelector('.popup');

    function showPopup(content) {
        console.log(content);
        popupContainer.innerHTML = `<div class="popup-content">${content}</div>
                                    <div class="btns"><img src="icons/copyIcon.png" class="copy"></img>
                                    <span class="popup-close">&times;</span>
                                    </div>`;
        popupContainer.classList.add('active');
    }

    // Function to close the popup
    function closePopup() {
        popupContainer.classList.remove('active');
        popupContainer.innerHTML = ''; // Clear popup content
    }

    showTranscriptBtn.addEventListener('click', function () {
        const transcriptContent = document.getElementById('transcript').innerHTML;
        showPopup(transcriptContent);
        document.querySelector('.copy').addEventListener('click', () => {
            copyClipboard('transcript');
        });
        document.querySelector('.popup-close').addEventListener('click', () => {
            closePopup();
        });
    });

    showSummaryBtn.addEventListener('click', function () {
        const summaryContent = document.getElementById('summary').innerHTML;
        showPopup(summaryContent);
        document.querySelector('.copy').addEventListener('click', () => {
            copyClipboard('summary');
        });
        document.querySelector('.popup-close').addEventListener('click', () => {
            closePopup();
        });
    });


    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let url = new URL(tabs[0].url);

        if (url.hostname === "www.youtube.com" && url.pathname === "/watch") {
            videoId = url.searchParams.get("v");
            fetchTranscript(videoId);
            fetchNotes(videoId);
        } else { }
    });
});


async function copyClipboard(elementId) {
    var copyClick = document.querySelector('.copy');
    try {
        var text = document.querySelector(`#${elementId} p`).innerText;
        await navigator.clipboard.writeText(text);
        copyClick.src = "icons/copyClick.png";
        console.log(copyClick);
    }
    catch (e) {
        console.log(e);
    }
    setTimeout(() => {
        copyClick.src = "icons/copyIcon.png";
    }, 2000)
}


async function fetchTranscript(videoId) {

    chrome.storage.local.get(['summaryCount'], async function (result) {
        summaryCount = result.summaryCount || 0;
        if (summaryCount < FREE_LIMIT) {
            try {
                const transcript = await getTranscriptFromRapidAPI(videoId);
                document.querySelector('#transcript p').innerText = transcript;
                chrome.storage.local.set({ ['transcript_' + videoId]: transcript });

                // summaryCount++;
                chrome.storage.local.set({ summaryCount: summaryCount });
            } catch (error) {
                console.error('Error fetching transcript:', error);
                document.getElementById('transcript').innerText = "Error fetching transcript.";
            }
        } else {
            document.getElementById('transcript').innerText = "You have reached the free Transcript limit. Please subscribe.";
            document.getElementById('summary').innerText = "You have reached the free summary limit. Please subscribe.";
            showSubscriptionOption();
        }
    });
}


async function getTranscriptFromRapidAPI(videoId) {
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY_TRANSCRIPT,
            'X-RapidAPI-Host': RAPIDAPI_HOST_TRANSCRIPT
        }
    };

    try {
        const requestURL = `https://${RAPIDAPI_HOST_TRANSCRIPT}/transcript?video_id=${videoId}&lang=en`;
        const response = await fetch(requestURL, options);
        if (!response.ok) {
            throw new Error(`Error fetching transcript: ${response.statusText}`);
        }
        const data = await response.json();
        return extractTranscript(data) || "No transcript available for this video.";
    } catch (error) {
        console.error("Error fetching transcript from RapidAPI: ", error);
        throw error;
    }
}

async function extractTranscript(data) {
    let str = "";
    let transcriptAsText = data[0].transcriptionAsText;
    fetchSummaryFromOpenAiAPI(transcriptAsText);
    for (let i = 0; i < data[0].transcription.length; i++) {
        str += data[0].transcription[i].start + ' - ' + data[0].transcription[i].dur + ' ' + data[0].transcription[i].subtitle + '  \n';
    }
    return str;
}


async function fetchSummaryFromOpenAiAPI(transcriptAsText) {
    chrome.storage.local.get(['summaryCount'], async function (result) {
        summaryCount = result.summaryCount || 0;

        if (summaryCount < FREE_LIMIT) {
            try {

                let summary = await getSummaryFromOpenAiApi(transcriptAsText);

                document.querySelector('#summary p').innerText = summary;
                chrome.storage.local.set({ ['summary_' + videoId]: summary });

                // summaryCount++;
                chrome.storage.local.set({ summaryCount: summaryCount });
            } catch (error) {
                console.error("Error fetching summary: ", error);
                document.getElementById('summary').innerText = "Error fetching summary.";
            }
        } else {
            document.getElementById('summary').innerText = "You have reached the free summary limit. Please subscribe.";
            showSubscriptionOption();
        }
    });
}

const maxTokens = 4096;
const maxPromptTokens = maxTokens - 500;


async function getSummaryFromOpenAiApi(transcriptAsText) {
    const apiKey = OPENAI_API_KEY;

    const estimatedTokens = Math.ceil(transcriptAsText.length / 4);
    if (estimatedTokens > maxPromptTokens) {
        const maxLength = Math.floor(maxPromptTokens * 4);
        transcriptAsText = transcriptAsText.slice(0, maxLength);
    }

    if (summaryCount < FREE_LIMIT) {
        try {
            const response = await fetch('https://api.openai.com/v1/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo-instruct', // maxTokens = 4096
                    prompt: `Summarize the following transcript:\n\n${transcriptAsText}`,
                    max_tokens: 400,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            console.log(data)
            const summary = data.choices[0].text.trim();
            return summary;
        } catch (error) {
            console.error('Error fetching summary from OpenAI:', error);
            return 'Error fetching summary.';
        }
    } else {
        document.getElementById('summary').innerText = "You have reached the free summary limit. Please subscribe.";
        showSubscriptionOption();
    }
}

async function fetchSummary(videoId) {
    chrome.storage.local.get(['summaryCount'], async function (result) {
        summaryCount = result.summaryCount || 0;

        if (summaryCount < FREE_LIMIT) {
            try {

                let summary = await getSummaryFromRapidAPI(videoId);

                document.getElementById('summary').innerText = summary;
                chrome.storage.local.set({ ['summary_' + videoId]: summary });

                // summaryCount++;
                chrome.storage.local.set({ summaryCount: summaryCount });
            } catch (error) {
                console.error("Error fetching summary: ", error);
                document.getElementById('summary').innerText = "Error fetching summary.";
            }
        } else {
            document.getElementById('summary').innerText = "You have reached the free summary limit. Please subscribe.";
            showSubscriptionOption();
        }
    });
}

async function getSummaryFromRapidAPI(videoId) {
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': RAPIDAPI_KEY_SUMMARY,
            'X-RapidAPI-Host': RAPIDAPI_HOST_SUMMARY
        }
    };

    try {
        const targetURL = `https://yt-api.p.rapidapi.com/dl?id=${videoId}`;
        const response = await fetch(targetURL, options);
        if (!response.ok) {
            throw new Error(`Error fetching summary: ${response.statusText}`);
        }
        const data = await response.json();
        return data.description || "No summary available for this video.";
    } catch (error) {
        console.error("Error fetching summary from RapidAPI: ", error);
        throw error;
    }
}

function fetchNotes(videoId) {
    chrome.storage.local.get(['notes_' + videoId], function (result) {
        let notes = result['notes_' + videoId];
        if (notes) {
            document.getElementById('notes').value = notes;
        }
    });
}

document.getElementById('save-notes').addEventListener('click', saveNotes);

function saveNotes() {
    let notes = document.getElementById('notes').value;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        let url = new URL(tabs[0].url);
        let videoId = url.searchParams.get("v");
        chrome.storage.local.set({ ['notes_' + videoId]: notes }, function () {
            alert("Notes saved.");
        });
    });
}

function checkSubscription() {
    chrome.storage.local.get(['subscribed'], function (result) {
        if (!result.subscribed) {
            showSubscriptionOption();
        }
    });
}

function showSubscriptionOption() {
    let subscriptionDiv = document.getElementById('subscription');
    subscriptionDiv.innerHTML = `
      <button id="subscribe">Subscribe</button>
    `;
    document.getElementById('subscribe').addEventListener('click', function () {
        const amount = 500; //  amount in paise (₹5.00)
        const email = 'user@example.com';

        const paymentUrl = `https://razorpay.com/`;

        // Open payment link in a new tab
        window.open(paymentUrl, '_blank');
    });
}

chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.set({ summaryCount: 0, subscribed: false });
});
