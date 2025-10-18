// TODO-2: implement the Forward+ fragment shader

// See naive.fs.wgsl for basic fragment shader setup; this shader should use light clusters instead of looping over all lights

// ------------------------------------
// Shading process:
// ------------------------------------
// Determine which cluster contains the current fragment.
// Retrieve the number of lights that affect the current fragment from the cluster’s data.
// Initialize a variable to accumulate the total light contribution for the fragment.
// For each light in the cluster:
//     Access the light's properties using its index.
//     Calculate the contribution of the light based on its position, the fragment’s position, and the surface normal.
//     Add the calculated contribution to the total light accumulation.
// Multiply the fragment’s diffuse color by the accumulated light contribution.
// Return the final color, ensuring that the alpha component is set appropriately (typically to 1).

@group(${bindGroup_scene}) @binding(0) var<uniform> camera: CameraUniforms;
@group(${bindGroup_scene}) @binding(1) var<storage, read> lightSet: LightSet;
@group(0) @binding(2) var<storage, read_write> clusters: array<u32>;
@group(0) @binding(3) var<storage, read_write> lightIndices: array<u32>;

@group(${bindGroup_material}) @binding(0) var diffuseTex: texture_2d<f32>;
@group(${bindGroup_material}) @binding(1) var diffuseTexSampler: sampler;

struct FragmentInput
{
    @location(0) pos: vec3f,
    @location(1) nor: vec3f,
    @location(2) uv: vec2f
}

@fragment
fn main(in: FragmentInput, @builtin(position) pos: vec4<f32>) -> @location(0) vec4f
{
    let diffuseColor = textureSample(diffuseTex, diffuseTexSampler, in.uv);
    if (diffuseColor.a < 0.5f) {
        discard;
    }

    // determine cluster xy
    let viewPos = camera.viewMat * vec4(in.pos.xyz, 1);

    let tileX = ${width}f / ${Nx}f;
    let tileY = ${height}f / ${Ny}f;
    let Cx = f32(pos.x) / tileX;
    let Cy = f32(pos.y) / tileY;

    let logFN = log(${far}f / ${near}f);
    let scale = ${Nz}f / logFN;
    let bias = - (${Nz}f * log(${near}f)) / logFN;

    let Cz = floor(log(-viewPos.z) * scale + bias);

    let clusterIdx = u32(Cx) +
                     u32(Cy) * ${Nx}u +
                     u32(Cz) * (${Nx}u * ${Ny}u);
    let clusterOffset = clusterIdx * ${clusterMaxLights};

    var totalLightContrib = vec3f(0, 0, 0);
    for (var i = 0u; i < clusters[clusterIdx]; i++) 
    {
        let lightIdx = lightIndices[i + clusterOffset];
        let light = lightSet.lights[lightIdx];
        totalLightContrib += calculateLightContrib(light, in.pos, normalize(in.nor));
    }

    var finalColor = diffuseColor.rgb * totalLightContrib;
    return vec4(finalColor, 1);

    // return vec4(f32(Cx) / ${Nx}, f32(Cy) / ${Ny}, f32(Cz) / ${Nz}, 1);
    // return vec4(f32(clusters[clusterIdx]) / ${clusterMaxLights}, f32(clusters[clusterIdx]) / ${clusterMaxLights}, f32(clusters[clusterIdx]) / ${clusterMaxLights}, 1); // cluster lights visualization
}
