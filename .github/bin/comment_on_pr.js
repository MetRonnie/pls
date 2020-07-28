const {execSync, curlOpts} = require('./util');
const {env} = process;
const pr_event = JSON.parse(env.PR_EVENT);

let isMilestoneClosed;
if (env.JOB_STATUS === 'success') {
    isMilestoneClosed = closeMilestone();
} else {
    updatePRTitle();
}

const nextSteps = `
Next steps for @${pr_event.assignees[0].login}:
- [view/edit the GitHub release description](${env.RELEASE_URL}) as appropriate
- ${isMilestoneClosed ? '✔️ Milestone automatically closed' : 'ℹ️ Close the milestone'}
`;

const manualInstructions = `
[Check the run](${pr_event.html_url}/checks)

If you need to publish the dist to PyPI manually:

(Make sure you have commit \`${env.MERGE_SHA}\` checked out)
\`\`\`shell
# Create the build
python3 setup.py bdist_wheel sdist
# Upload your build to PyPI
twine upload dist/*
\`\`\`
`;

const footer = `
___
Comment created by workflow: \`${env.WORKFLOW}\`, run: \`${env.RUN_NUMBER}\`
`;

const bodyText = () => {
    let icon = '✔️';
    let content = nextSteps;
    if (env.JOB_STATUS !== 'success') {
        icon = '❌';
        content = manualInstructions;
    }
    const title = `### ${icon} \`${env.JOB_STATUS}\` \n`;
    return [title, content, footer].join('');
};

const payload = JSON.stringify({
    body: bodyText()
});

execSync(`curl -X POST \
    ${pr_event.comments_url} \
    -H "authorization: Bearer $GITHUB_TOKEN" \
    -H "content-type: application/json" \
    --data '${payload}' \
    ${curlOpts}`
);



function closeMilestone() {
    if (pr_event.milestone) {
        const patch = JSON.stringify({
            state: 'closed'
        });
        try {
            execSync(`curl -X PATCH \
                https://api.github.com/repos/${env.REPOSITORY}/milestones/${pr_event.milestone} \
                -H "authorization: Bearer $GITHUB_TOKEN" \
                -H "content-type: application/json" \
                --data '${patch}' \
                ${curlOpts}`
            );
            return true;
        } catch (err) {
            console.log(`::warning:: Error closing milestone ${pr_event.milestone}`);
            console.log(err, '\n');
        }
    }
    return false;
}

function updatePRTitle() {
    const patch = JSON.stringify({
        title: `[${env.JOB_STATUS}] ${pr_event.title}`
    });
    execSync(`curl -X PATCH \
        ${pr_event.url} \
        -H "authorization: Bearer $GITHUB_TOKEN" \
        -H "content-type: application/json" \
        --data '${patch}' \
        ${curlOpts}`
    );
}
