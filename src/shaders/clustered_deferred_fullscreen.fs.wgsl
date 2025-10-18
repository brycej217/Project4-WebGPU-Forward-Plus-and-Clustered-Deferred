// TODO-3: implement the Clustered Deferred fullscreen fragment shader

// Similar to the Forward+ fragment shader, but with vertex information coming from the G-buffer instead.

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<storage, read> lightSet: LightSet;
@group(0) @binding(2) var<storage, read_write> clusters: array<u32>;
@group(0) @binding(3) var<storage, read_write> lightIndices: array<u32>;
@group(0) @binding(4) var posTex: texture_2d<f32>;
@group(0) @binding(5) var normalTex: texture_2d<f32>;
@group(0) @binding(6) var albedoTex: texture_2d<f32>;
@group(0) @binding(7) var texSampler: sampler;

@fragment
fn main(@builtin(position) screenPos: vec4<f32>) -> @location(0) vec4f
{
    let pix = vec2<i32>(floor(screenPos.xy));

  let pos    = vec4<f32>(textureLoad(posTex, pix, 0).xyz, 1.0);
  let normal = textureLoad(normalTex, pix, 0).xyz;
  let diffuseColor = textureLoad(albedoTex, pix, 0);

    // determine cluster xy
    let viewPos = camera.viewMat * vec4(pos.xyz, 1);

    let tileX = ${width}f / ${Nx}f;
    let tileY = ${height}f / ${Ny}f;
    let Cx = f32(screenPos.x) / tileX;
    let Cy = f32(screenPos.y) / tileY;

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
        totalLightContrib += calculateLightContrib(light, pos.xyz, normalize(normal));
    }

    var finalColor = diffuseColor.rgb * totalLightContrib;
    return vec4(finalColor, 1);

    // return vec4(f32(Cx) / ${Nx}, f32(Cy) / ${Ny}, f32(Cz) / ${Nz}, 1);
    // return vec4(f32(clusters[clusterIdx]) / ${clusterMaxLights}, f32(clusters[clusterIdx]) / ${clusterMaxLights}, f32(clusters[clusterIdx]) / ${clusterMaxLights}, 1); // cluster lights visualization
}
