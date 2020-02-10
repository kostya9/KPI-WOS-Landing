import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import * as fs from "fs";
import * as mime from "mime";
import * as path from "path";

const stackConfig = new pulumi.Config("static-website");


// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("wos-landing-static-server", {
    acl: "public-read",

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
        indexDocument: "index.html"
    },
});

var webRootRelative = "../www";
let files = fs.readdirSync(webRootRelative);
for(const filePath of files) {
    const relativeFilePath = path.join(webRootRelative, filePath);
        const contentFile = new aws.s3.BucketObject(
            relativeFilePath,
            {
                key: filePath,

                acl: "public-read",
                bucket: bucket,
                contentType: mime.getType(filePath) || undefined,
                source: new pulumi.asset.FileAsset(relativeFilePath),
            },
            {
                parent: bucket,
            });
}

// Export the name of the bucket
export const bucketName = bucket.id;
export const bucketAddress = bucket.websiteEndpoint;